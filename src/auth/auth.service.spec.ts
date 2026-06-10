import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

const CONFIG: Record<string, string> = {
  'auth.accessSecret': 'access-secret',
  'auth.accessExpiresIn': '15m',
  'auth.refreshSecret': 'refresh-secret',
  'auth.refreshExpiresIn': '7d',
};

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

describe('AuthService', () => {
  let usersService: {
    create: jest.Mock;
    findByEmail: jest.Mock;
    findById: jest.Mock;
    setRefreshTokenHash: jest.Mock;
  };
  let jwtService: JwtService;
  let service: AuthService;
  let user: User;

  beforeEach(async () => {
    user = {
      id: 'user-1',
      email: 'jane@example.com',
      passwordHash: await bcrypt.hash('password123', 4),
      refreshTokenHash: null,
      createdAt: new Date(),
    };
    usersService = {
      create: jest.fn().mockResolvedValue(user),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      setRefreshTokenHash: jest.fn(),
    };
    jwtService = new JwtService({});
    const configService = {
      getOrThrow: jest.fn((key: string) => CONFIG[key]),
    } as unknown as ConfigService;
    service = new AuthService(usersService as unknown as UsersService, jwtService, configService);
  });

  it('exposes cookie TTLs derived from token expiries', () => {
    expect(service.accessTokenTtlMs).toBe(15 * 60 * 1000);
    expect(service.refreshTokenTtlMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  describe('register', () => {
    it('hashes the password, stores the user and issues both tokens', async () => {
      const result = await service.register({ email: user.email, password: 'password123' });

      const [, storedHash] = usersService.create.mock.calls[0];
      await expect(bcrypt.compare('password123', storedHash)).resolves.toBe(true);

      const payload = await jwtService.verifyAsync(result.accessToken, {
        secret: 'access-secret',
      });
      expect(payload).toMatchObject({ sub: 'user-1', email: user.email });
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith(
        'user-1',
        sha256(result.refreshToken),
      );
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      const result = await service.login({ email: user.email, password: 'password123' });

      expect(result.user).toEqual({ id: 'user-1', email: user.email });
      expect(result.accessToken).toBeTruthy();
    });

    it('rejects unknown emails', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects wrong passwords', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      await expect(
        service.login({ email: user.email, password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    const issueRefreshToken = (): Promise<string> =>
      new JwtService({}).signAsync(
        { sub: 'user-1' },
        { secret: 'refresh-secret', expiresIn: '7d' },
      );

    it('rotates a valid refresh token', async () => {
      const refreshToken = await issueRefreshToken();
      usersService.findById.mockResolvedValue({ ...user, refreshTokenHash: sha256(refreshToken) });

      const result = await service.refresh(refreshToken);

      expect(result.accessToken).toBeTruthy();
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith('user-1', expect.any(String));
    });

    it('rejects a missing token', async () => {
      await expect(service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a token signed with the wrong secret', async () => {
      const forged = await new JwtService({}).signAsync(
        { sub: 'user-1' },
        { secret: 'not-the-secret', expiresIn: '7d' },
      );

      await expect(service.refresh(forged)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a revoked token (no stored hash)', async () => {
      const refreshToken = await issueRefreshToken();
      usersService.findById.mockResolvedValue({ ...user, refreshTokenHash: null });

      await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a superseded token (hash mismatch after rotation)', async () => {
      const refreshToken = await issueRefreshToken();
      usersService.findById.mockResolvedValue({
        ...user,
        refreshTokenHash: sha256('a-newer-token'),
      });

      await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  it('issues unique refresh tokens even within the same second', async () => {
    usersService.findByEmail.mockResolvedValue(user);

    const [first, second] = await Promise.all([
      service.login({ email: user.email, password: 'password123' }),
      service.login({ email: user.email, password: 'password123' }),
    ]);

    // Identical sub + iat must not produce identical tokens, or rotation
    // and revocation would silently stop working.
    expect(first.refreshToken).not.toBe(second.refreshToken);
  });

  it('logout clears the stored refresh token hash', async () => {
    await service.logout('user-1');

    expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith('user-1', null);
  });
});

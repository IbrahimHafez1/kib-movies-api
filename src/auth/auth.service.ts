import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'crypto';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { parseDurationMs } from './duration.util';

const BCRYPT_ROUNDS = 10;

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.accessSecret = configService.getOrThrow<string>('auth.accessSecret');
    this.accessExpiresIn = configService.getOrThrow<string>('auth.accessExpiresIn');
    this.refreshSecret = configService.getOrThrow<string>('auth.refreshSecret');
    this.refreshExpiresIn = configService.getOrThrow<string>('auth.refreshExpiresIn');
  }

  get accessTokenTtlMs(): number {
    return parseDurationMs(this.accessExpiresIn);
  }

  get refreshTokenTtlMs(): number {
    return parseDurationMs(this.refreshExpiresIn);
  }

  async register(registerDto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(registerDto.password, BCRYPT_ROUNDS);
    const user = await this.usersService.create(registerDto.email, passwordHash);
    return this.issueTokens(user);
  }

  async login(loginDto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(loginDto.email);
    const passwordMatches = user && (await bcrypt.compare(loginDto.password, user.passwordHash));
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueTokens(user);
  }

  /**
   * Exchanges a valid refresh token for a new token pair.
   * Tokens are rotated: the presented token is invalidated by overwriting
   * the stored hash, so a stolen refresh token can be used at most once.
   */
  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user?.refreshTokenHash || !this.tokenMatchesHash(refreshToken, user.refreshTokenHash)) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }
    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  private async issueTokens(user: User): Promise<AuthResult> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: user.id, email: user.email },
        { secret: this.accessSecret, expiresIn: this.accessExpiresIn },
      ),
      this.jwtService.signAsync(
        { sub: user.id },
        { secret: this.refreshSecret, expiresIn: this.refreshExpiresIn },
      ),
    ]);
    await this.usersService.setRefreshTokenHash(user.id, this.hashToken(refreshToken));
    return { accessToken, refreshToken, user: { id: user.id, email: user.email } };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private tokenMatchesHash(token: string, storedHash: string): boolean {
    const presentedHash = this.hashToken(token);
    if (presentedHash.length !== storedHash.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(presentedHash), Buffer.from(storedHash));
  }
}

import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const authResult = {
    accessToken: 'access-jwt',
    refreshToken: 'refresh-jwt',
    user: { id: 'user-1', email: 'jane@example.com' },
  };
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
    accessTokenTtlMs: number;
    refreshTokenTtlMs: number;
  };
  let response: { cookie: jest.Mock; clearCookie: jest.Mock };
  let controller: AuthController;

  beforeEach(() => {
    authService = {
      register: jest.fn().mockResolvedValue(authResult),
      login: jest.fn().mockResolvedValue(authResult),
      refresh: jest.fn().mockResolvedValue(authResult),
      logout: jest.fn(),
      accessTokenTtlMs: 900_000,
      refreshTokenTtlMs: 604_800_000,
    };
    response = { cookie: jest.fn(), clearCookie: jest.fn() };
    const configService = { get: jest.fn().mockReturnValue('test') } as unknown as ConfigService;
    controller = new AuthController(authService as unknown as AuthService, configService);
  });

  it('register sets httpOnly cookies and omits the refresh token from the body', async () => {
    const body = await controller.register(
      { email: 'jane@example.com', password: 'password123' },
      response as unknown as Response,
    );

    expect(body).toEqual({ accessToken: 'access-jwt', user: authResult.user });
    expect(response.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'access-jwt',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', maxAge: 900_000 }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'refresh-jwt',
      expect.objectContaining({ httpOnly: true, path: '/auth', maxAge: 604_800_000 }),
    );
  });

  it('login delegates and sets cookies', async () => {
    await controller.login(
      { email: 'jane@example.com', password: 'password123' },
      response as unknown as Response,
    );

    expect(authService.login).toHaveBeenCalled();
    expect(response.cookie).toHaveBeenCalledTimes(2);
  });

  it('refresh reads the token from the httpOnly cookie', async () => {
    const request = { cookies: { [REFRESH_TOKEN_COOKIE]: 'refresh-jwt' } } as unknown as Request;

    await controller.refresh(request, response as unknown as Response);

    expect(authService.refresh).toHaveBeenCalledWith('refresh-jwt');
    expect(response.cookie).toHaveBeenCalledTimes(2);
  });

  it('refresh tolerates requests without cookies', async () => {
    const request = {} as Request;

    await controller.refresh(request, response as unknown as Response);

    expect(authService.refresh).toHaveBeenCalledWith(undefined);
  });

  it('logout revokes the refresh token and clears both cookies', async () => {
    const body = await controller.logout(
      { userId: 'user-1', email: 'jane@example.com' },
      response as unknown as Response,
    );

    expect(body).toEqual({ message: 'Logged out' });
    expect(authService.logout).toHaveBeenCalledWith('user-1');
    expect(response.clearCookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      expect.objectContaining({ httpOnly: true }),
    );
    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ path: '/auth' }),
    );
  });
});

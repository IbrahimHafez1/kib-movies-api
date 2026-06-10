import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants';
import { accessTokenCookieExtractor, JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('access-secret'),
  } as unknown as ConfigService;

  it('maps the JWT payload to the authenticated user shape', () => {
    const strategy = new JwtStrategy(configService);

    expect(strategy.validate({ sub: 'user-1', email: 'jane@example.com' })).toEqual({
      userId: 'user-1',
      email: 'jane@example.com',
    });
  });

  describe('accessTokenCookieExtractor', () => {
    it('reads the access token cookie', () => {
      const request = { cookies: { [ACCESS_TOKEN_COOKIE]: 'jwt' } } as unknown as Request;
      expect(accessTokenCookieExtractor(request)).toBe('jwt');
    });

    it('returns null when the cookie is absent', () => {
      expect(accessTokenCookieExtractor({} as Request)).toBeNull();
      expect(accessTokenCookieExtractor({ cookies: {} } as unknown as Request)).toBeNull();
    });
  });
});

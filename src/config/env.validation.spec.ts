import 'reflect-metadata';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('accepts a valid configuration', () => {
    const result = validateEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      DB_HOST: 'db',
      TMDB_SYNC_PAGES: '5',
    });

    expect(result.PORT).toBe(8080);
    expect(result.NODE_ENV).toBe('production');
  });

  it('accepts an empty configuration (all variables have defaults)', () => {
    expect(() => validateEnv({})).not.toThrow();
  });

  it('rejects an out-of-range port', () => {
    expect(() => validateEnv({ PORT: '99999' })).toThrow(/Invalid environment configuration/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging' })).toThrow(/Invalid environment configuration/);
  });

  it('rejects non-numeric sync pages', () => {
    expect(() => validateEnv({ TMDB_SYNC_PAGES: 'lots' })).toThrow(
      /Invalid environment configuration/,
    );
  });
});

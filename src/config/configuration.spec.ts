import configuration from './configuration';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('provides sensible defaults when env vars are unset', () => {
    delete process.env.PORT;
    delete process.env.DB_HOST;
    delete process.env.TMDB_API_KEY;

    const config = configuration();

    expect(config.app.port).toBe(8080);
    expect(config.database.host).toBe('localhost');
    expect(config.tmdb.apiKey).toBe('');
    expect(config.tmdb.syncPages).toBe(5);
  });

  it('reads values from environment variables', () => {
    process.env.PORT = '3000';
    process.env.DB_HOST = 'db';
    process.env.TMDB_API_KEY = 'secret-key';
    process.env.TMDB_SYNC_PAGES = '10';

    const config = configuration();

    expect(config.app.port).toBe(3000);
    expect(config.database.host).toBe('db');
    expect(config.tmdb.apiKey).toBe('secret-key');
    expect(config.tmdb.syncPages).toBe(10);
  });
});

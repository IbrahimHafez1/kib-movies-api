import 'dotenv/config';

// The suite needs a running Postgres and Redis (docker-compose.dev.yml or CI
// services). It provisions its own database so developer data is untouched.
process.env.DB_HOST = process.env.DB_HOST ?? 'localhost';
process.env.DB_PORT = process.env.DB_PORT ?? '55432';
process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT ?? '56379';
process.env.DB_NAME = 'movies_e2e';
process.env.NODE_ENV = 'test';
process.env.TMDB_API_KEY = '';
process.env.JWT_ACCESS_SECRET = 'e2e-access-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Cache } from 'cache-manager';
import { Client } from 'pg';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Genre } from '../src/genres/entities/genre.entity';
import { Movie } from '../src/movies/entities/movie.entity';

jest.setTimeout(120_000);

const adminConnection = () =>
  new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: 'postgres',
  });

async function recreateDatabase(): Promise<void> {
  const admin = adminConnection();
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS movies_e2e WITH (FORCE)');
  await admin.query('CREATE DATABASE movies_e2e');
  await admin.end();
}

async function seed(dataSource: DataSource): Promise<void> {
  const genresRepository = dataSource.getRepository(Genre);
  const moviesRepository = dataSource.getRepository(Movie);

  const [action, thriller, drama] = await genresRepository.save([
    { id: 28, name: 'Action' },
    { id: 53, name: 'Thriller' },
    { id: 18, name: 'Drama' },
  ]);

  await moviesRepository.save([
    moviesRepository.create({
      id: 603,
      title: 'The Matrix',
      originalTitle: 'The Matrix',
      overview: 'A hacker discovers reality is a simulation.',
      releaseDate: '1999-03-31',
      posterPath: '/matrix.jpg',
      backdropPath: '/matrix-bg.jpg',
      originalLanguage: 'en',
      popularity: 85.5,
      tmdbVoteAverage: 8.2,
      tmdbVoteCount: 25_000,
      genres: [action, thriller],
    }),
    moviesRepository.create({
      id: 155,
      title: 'The Dark Knight',
      originalTitle: 'The Dark Knight',
      overview: 'Batman faces the Joker.',
      releaseDate: '2008-07-16',
      posterPath: '/tdk.jpg',
      backdropPath: '/tdk-bg.jpg',
      originalLanguage: 'en',
      popularity: 95.1,
      tmdbVoteAverage: 8.5,
      tmdbVoteCount: 32_000,
      genres: [action, drama],
    }),
    moviesRepository.create({
      id: 550,
      title: 'Fight Club',
      originalTitle: 'Fight Club',
      overview: 'An office worker forms an underground club.',
      releaseDate: '1999-10-15',
      posterPath: '/fc.jpg',
      backdropPath: '/fc-bg.jpg',
      originalLanguage: 'en',
      popularity: 70.2,
      tmdbVoteAverage: 8.4,
      tmdbVoteCount: 29_000,
      genres: [drama],
    }),
  ]);
}

const refreshCookieOf = (response: request.Response): string => {
  const cookies: string[] = response.get('Set-Cookie') ?? [];
  const refresh = cookies.find((cookie) => cookie.startsWith('refresh_token='));
  expect(refresh).toBeDefined();
  return (refresh as string).split(';')[0];
};

describe('Movies API (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    await recreateDatabase();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();

    // Migrations created the schema during init; start from a clean cache.
    await app.get<Cache>(CACHE_MANAGER).reset();
    await seed(app.get(DataSource));
    server = app.getHttpServer();
  });

  afterAll(async () => {
    const cacheManager = app.get<Cache>(CACHE_MANAGER) as Cache & {
      store?: { client?: { quit: () => Promise<unknown> } };
    };
    await app.close();
    await cacheManager.store?.client?.quit().catch(() => undefined);
  });

  describe('public catalog', () => {
    it('GET / describes the service', async () => {
      const response = await request(server).get('/').expect(200);
      expect(response.body).toMatchObject({ name: 'Movies API', docs: '/docs' });
    });

    it('GET /health reports database and cache as up', async () => {
      const response = await request(server).get('/health').expect(200);
      expect(response.body).toMatchObject({ status: 'ok', database: 'up', cache: 'up' });
    });

    it('GET /genres lists genres alphabetically', async () => {
      const response = await request(server).get('/genres').expect(200);
      expect(response.body.map((genre: Genre) => genre.name)).toEqual([
        'Action',
        'Drama',
        'Thriller',
      ]);
    });

    it('GET /movies returns the paginated catalog with rating fields', async () => {
      const response = await request(server).get('/movies').expect(200);

      expect(response.body.meta).toMatchObject({ page: 1, totalItems: 3, hasNextPage: false });
      expect(response.body.data[0]).toMatchObject({
        title: 'The Dark Knight',
        averageRating: 0,
        ratingCount: 0,
      });
    });

    it('filters by genre name and by TMDB genre id', async () => {
      const byName = await request(server).get('/movies?genre=Drama').expect(200);
      expect(byName.body.meta.totalItems).toBe(2);

      const byId = await request(server).get('/movies?genre=18').expect(200);
      expect(byId.body.meta.totalItems).toBe(2);
    });

    it('searches by title fragment, case-insensitively', async () => {
      const response = await request(server).get('/movies?search=matrix').expect(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('The Matrix');
    });

    it('paginates with stable ordering', async () => {
      const response = await request(server).get('/movies?page=2&limit=2').expect(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta).toMatchObject({ page: 2, totalPages: 2, hasNextPage: false });
    });

    it('rejects out-of-range pagination input', async () => {
      await request(server).get('/movies?limit=5000').expect(400);
      await request(server).get('/movies?page=0').expect(400);
    });

    it('returns 404 for an unknown movie id', async () => {
      await request(server).get('/movies/999999').expect(404);
    });
  });

  describe('auth, ratings and watchlist', () => {
    let cookieAgent: ReturnType<typeof request.agent>;
    let initialRefreshCookie: string;
    let bearerToken: string;

    beforeAll(() => {
      cookieAgent = request.agent(server);
    });

    it('registers a user and sets httpOnly auth cookies', async () => {
      const response = await cookieAgent
        .post('/auth/register')
        .send({ email: 'Jane@Example.com ', password: 'password123' })
        .expect(201);

      // Email is normalized before storage.
      expect(response.body.user.email).toBe('jane@example.com');
      expect(response.body.accessToken).toBeTruthy();
      expect(response.body.refreshToken).toBeUndefined();

      const cookies = response.get('Set-Cookie') ?? [];
      expect(cookies.some((c) => c.startsWith('access_token=') && c.includes('HttpOnly'))).toBe(
        true,
      );
      expect(
        cookies.some((c) => c.startsWith('refresh_token=') && c.includes('Path=/auth')),
      ).toBe(true);
      initialRefreshCookie = refreshCookieOf(response);
    });

    it('rejects duplicate registration regardless of email casing', async () => {
      await cookieAgent
        .post('/auth/register')
        .send({ email: 'jane@example.com', password: 'password123' })
        .expect(409);
    });

    it('validates registration input', async () => {
      await cookieAgent
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);
      await cookieAgent
        .post('/auth/register')
        .send({ email: 'short@example.com', password: 'short' })
        .expect(400);
    });

    it('rejects bad credentials on login', async () => {
      await cookieAgent
        .post('/auth/login')
        .send({ email: 'jane@example.com', password: 'wrong-password' })
        .expect(401);
    });

    it('requires authentication for ratings', async () => {
      await request(server).put('/movies/603/ratings').send({ value: 8 }).expect(401);
    });

    it('rates a movie via the httpOnly cookie and updates the average', async () => {
      await cookieAgent.put('/movies/603/ratings').send({ value: 9 }).expect(200);

      const detail = await request(server).get('/movies/603').expect(200);
      expect(detail.body).toMatchObject({ averageRating: 9, ratingCount: 1 });
    });

    it('re-rating updates instead of duplicating, and busts the cache', async () => {
      // Prime the cached detail and list responses.
      await request(server).get('/movies/603').expect(200);
      await request(server).get('/movies').expect(200);

      await cookieAgent.put('/movies/603/ratings').send({ value: 7 }).expect(200);

      const detail = await request(server).get('/movies/603').expect(200);
      expect(detail.body).toMatchObject({ averageRating: 7, ratingCount: 1 });

      const list = await request(server).get('/movies').expect(200);
      const matrix = list.body.data.find((movie: { id: number }) => movie.id === 603);
      expect(matrix).toMatchObject({ averageRating: 7, ratingCount: 1 });
    });

    it('averages ratings across users and supports bearer tokens', async () => {
      const login = await request(server)
        .post('/auth/register')
        .send({ email: 'john@example.com', password: 'password123' })
        .expect(201);
      bearerToken = login.body.accessToken;

      await request(server)
        .put('/movies/603/ratings')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({ value: 10 })
        .expect(200);

      const detail = await request(server).get('/movies/603').expect(200);
      expect(detail.body).toMatchObject({ averageRating: 8.5, ratingCount: 2 });
    });

    it('sorts the catalog by average user rating', async () => {
      const response = await request(server)
        .get('/movies?sortBy=averageRating&order=DESC')
        .expect(200);
      expect(response.body.data[0].id).toBe(603);
    });

    it('validates rating values and movie existence', async () => {
      await cookieAgent.put('/movies/603/ratings').send({ value: 15 }).expect(400);
      await cookieAgent.put('/movies/603/ratings').send({ value: 0 }).expect(400);
      await cookieAgent.put('/movies/999999/ratings').send({ value: 5 }).expect(404);
    });

    it('deletes a rating exactly once', async () => {
      await request(server)
        .delete('/movies/603/ratings')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(204);
      await request(server)
        .delete('/movies/603/ratings')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(404);

      const detail = await request(server).get('/movies/603').expect(200);
      expect(detail.body).toMatchObject({ averageRating: 7, ratingCount: 1 });
    });

    it('manages the watchlist with duplicate and missing-movie handling', async () => {
      await cookieAgent.post('/watchlist/155').expect(201);
      await cookieAgent.post('/watchlist/155').expect(409);
      await cookieAgent.post('/watchlist/999999').expect(404);

      const list = await cookieAgent.get('/watchlist').expect(200);
      expect(list.body.meta.totalItems).toBe(1);
      expect(list.body.data[0].movie).toMatchObject({ id: 155, title: 'The Dark Knight' });

      await cookieAgent.delete('/watchlist/155').expect(204);
      await cookieAgent.delete('/watchlist/155').expect(404);
    });

    it('keeps watchlists private per user', async () => {
      await cookieAgent.post('/watchlist/550').expect(201);

      const otherUsersList = await request(server)
        .get('/watchlist')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);
      expect(otherUsersList.body.meta.totalItems).toBe(0);
    });

    it('rotates refresh tokens: an old refresh token works once, then never again', async () => {
      const refreshed = await request(server)
        .post('/auth/refresh')
        .set('Cookie', initialRefreshCookie)
        .expect(200);
      expect(refreshed.body.accessToken).toBeTruthy();

      // The presented token was rotated out; replaying it must fail.
      await request(server)
        .post('/auth/refresh')
        .set('Cookie', initialRefreshCookie)
        .expect(401);
    });

    it('refresh without a cookie is rejected', async () => {
      await request(server).post('/auth/refresh').expect(401);
    });

    it('logout revokes the refresh token', async () => {
      const login = await cookieAgent
        .post('/auth/login')
        .send({ email: 'jane@example.com', password: 'password123' })
        .expect(200);
      const latestRefreshCookie = refreshCookieOf(login);

      await cookieAgent.post('/auth/logout').expect(200);

      await request(server)
        .post('/auth/refresh')
        .set('Cookie', latestRefreshCookie)
        .expect(401);
    });

    it('protects the manual sync endpoint and skips cleanly without a TMDB key', async () => {
      await request(server).post('/sync').expect(401);

      const response = await request(server)
        .post('/sync')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);
      expect(response.body).toEqual({ genres: 0, movies: 0 });
    });
  });
});

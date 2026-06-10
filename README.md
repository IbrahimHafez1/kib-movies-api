# Movies API

A production-ready RESTful API built with **NestJS** that syncs movie data from [TMDB](https://www.themoviedb.org/) into PostgreSQL and lets users browse, search, rate and watchlist movies. Reads are cached in Redis, writes are protected with JWT auth delivered via httpOnly cookies.

## Features

- **TMDB sync** — genres and popular movies are upserted on first boot, daily (cron), or on demand via `POST /sync`. Syncs are idempotent, so re-runs and future data additions are safe.
- **Browse movies** — pagination, title search, genre filtering (by name or TMDB id), sorting by popularity, release date, title or average user rating.
- **Ratings** — authenticated users rate movies 1–10 (create/update/delete); every movie response includes the live average rating and rating count.
- **Watchlist** — add/remove/list movies per user.
- **Caching** — Redis-backed read cache with O(1) namespace invalidation when ratings or syncs change the data.
- **Auth** — JWT access tokens (15 min) + rotating refresh tokens (7 days), both as httpOnly cookies; `Authorization: Bearer` is also accepted for non-browser clients. Refresh tokens are stored hashed and revoked on logout.
- **Hardening** — rate limiting, helmet security headers, strict input validation, race-safe writes, TMDB retries with backoff, non-root Docker runtime.

## Tech Stack

| Layer      | Choice                                  |
| ---------- | --------------------------------------- |
| Runtime    | Node.js 22, NestJS 10, TypeScript       |
| Database   | PostgreSQL 16 + TypeORM (migrations)    |
| Cache      | Redis 7 via cache-manager               |
| Auth       | Passport JWT, bcryptjs, httpOnly cookies|
| Docs       | OpenAPI / Swagger UI                    |
| Tests      | Jest unit tests (>85% coverage enforced) + supertest e2e |
| CI         | GitHub Actions (lint, tests, e2e, image build) |
| Packaging  | Docker multi-stage build, docker-compose|

## Quick Start

Prerequisites: Docker with the Compose plugin. Nothing else needs to be installed.

```bash
# 1. (Optional but recommended) provide a TMDB API key so the database self-populates
echo "TMDB_API_KEY=<your v3 api key>" > .env

# 2. Build and run everything
docker-compose up
```

The API is now available at **http://localhost:8080** and the interactive Swagger documentation at **http://localhost:8080/docs**.

On first boot the app runs database migrations and, if a TMDB key is configured, syncs genres plus `TMDB_SYNC_PAGES` pages of popular movies (default 5 pages ≈ 100 movies). Without a key the app still runs; trigger a sync later with `POST /sync` once the key is set.

### Local development (without Docker for the app)

```bash
npm install
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db redis
cp .env.example .env   # set DB_PORT=55432, REDIS_PORT=56379 to match the dev override
npm run start:dev
```

## API Overview

Full request/response schemas live in Swagger (`/docs`). Endpoints marked 🔒 require authentication.

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/movies` | List movies — `page`, `limit`, `search`, `genre` (name or id), `sortBy` (`popularity`,`releaseDate`,`title`,`averageRating`), `order`. Includes average user rating per movie. |
| GET | `/movies/:id` | Movie details with genres and rating stats |
| GET | `/genres` | List all genres |
| PUT 🔒 | `/movies/:id/ratings` | Rate a movie 1–10 (creates or updates your rating) |
| DELETE 🔒 | `/movies/:id/ratings` | Remove your rating |
| GET 🔒 | `/watchlist` | Your watchlist (paginated) |
| POST 🔒 | `/watchlist/:movieId` | Add a movie to your watchlist |
| DELETE 🔒 | `/watchlist/:movieId` | Remove a movie from your watchlist |
| POST | `/auth/register` | Create an account (sets auth cookies) |
| POST | `/auth/login` | Log in (sets auth cookies) |
| POST | `/auth/refresh` | Rotate the refresh token, issue a new access token |
| POST 🔒 | `/auth/logout` | Revoke the refresh token, clear cookies |
| POST 🔒 | `/sync` | Trigger a TMDB sync on demand |
| GET | `/health` | Liveness + database/cache connectivity (used by the Docker healthcheck) |

Example:

```bash
# Register and capture cookies
curl -c jar.txt -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"S3cure-password"}'

# Rate a movie using the httpOnly cookie
curl -b jar.txt -X PUT http://localhost:8080/movies/603/ratings \
  -H "Content-Type: application/json" -d '{"value":9}'

# Browse action movies sorted by user rating
curl "http://localhost:8080/movies?genre=Action&sortBy=averageRating&order=DESC"
```

## Project Structure

```
.github/workflows/  # CI: lint, unit + e2e tests against real services, image build
src/
├── auth/        # register/login/refresh/logout, JWT strategy & guard, cookies
├── cache/       # Redis cache facade (getOrSet + namespace version invalidation)
├── common/      # shared DTOs (pagination), decorators, db error helpers
├── config/      # typed configuration + env validation
├── database/    # TypeORM setup, CLI data source, migrations
├── genres/      # genre entity + listing endpoint
├── health/      # liveness endpoint covering Postgres and Redis
├── movies/      # movie listing/search/filter/sort with rating aggregation
├── ratings/     # rate/unrate endpoints (upsert semantics)
├── sync/        # TMDB -> DB sync (bootstrap, cron, manual trigger)
├── tmdb/        # typed TMDB API client with retry/backoff
├── users/       # user persistence
└── watchlist/   # per-user watchlist endpoints
test/            # end-to-end suite exercising real HTTP, Postgres and Redis
```

Each module owns its entities, DTOs, service and controller. Cross-module access goes through exported services (e.g. ratings invalidate movie caches through `MoviesService`), keeping boundaries explicit and the modules independently testable.

## Design Decisions

- **TMDB ids as primary keys** for movies/genres make the sync a plain upsert — no id mapping tables, and re-syncs converge instead of duplicating. Adding more TMDB resources (top-rated, now-playing, TV) is a matter of new fetcher + the same upsert.
- **Average rating in SQL, not application code.** The list endpoint aggregates ratings with a grouped query (and sorts by rating through a subquery), so the work happens where the indexes are.
- **Cache invalidation by namespace version.** List responses are cached under `movies:list:v{N}:{query}`; a rating write or sync bumps `N` once instead of hunting down every cached query permutation. Movie detail keys are deleted directly.
- **Indexes where queries actually go**: trigram (pg_trgm) GIN index for `ILIKE` title search, btree indexes on popularity/release date/title for sorting, FK indexes on ratings and the genre join table.
- **Refresh token rotation** with SHA-256 hashed storage: a stolen refresh token works at most once, and tokens never sit in localStorage thanks to httpOnly cookies.
- **Migrations over `synchronize`** — the schema is versioned and applied automatically on startup, which is safe to ship.
- **The database is the arbiter for races.** Existence pre-checks give friendly errors for the common case, but concurrent writes (same rating, watchlist entry or email registered twice at once) are resolved by unique constraints and translated into proper 409/404 responses instead of 500s.
- **Transient-failure resilience**: TMDB calls retry with exponential backoff on network errors, 5xx and 429 — but never on client errors, because retrying a bad API key cannot succeed.

## Trade-offs (made consciously)

- **One refresh token per user**: logging in on a second device invalidates the first device's refresh token. Multi-session support would move refresh tokens into their own table; out of scope here.
- **Any authenticated user can trigger `/sync`**: it is idempotent and rate-limited, so the blast radius is a few TMDB calls. A role system (admin-only sync) is the natural next step.
- **Movies are read-only by design**: TMDB is the source of truth and the sync would overwrite manual edits. User-generated state lives in ratings and watchlists, which have full create/update/delete.

## Configuration

All settings come from environment variables (see `.env.example`):

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `8080` | HTTP port |
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME` | `localhost` / `5432` / `postgres` / `postgres` / `movies` | PostgreSQL connection |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | Redis connection |
| `CACHE_TTL_MS` | `60000` | TTL for cached read responses |
| `TMDB_API_KEY` | _(empty)_ | TMDB v3 API key; sync is skipped (with a warning) when unset |
| `TMDB_BASE_URL` | `https://api.themoviedb.org/3` | TMDB API base URL |
| `TMDB_SYNC_PAGES` | `5` | Popular-movie pages to sync (20 movies per page) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | dev defaults | Token signing secrets — set real values in production |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `15m` / `7d` | Token lifetimes |

## Testing

```bash
npm test          # unit tests
npm run test:cov  # with coverage (fails below 85% on any metric)
npm run lint      # eslint + prettier

# e2e: spins nothing up itself - start the dev database/cache first
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db redis
npm run test:e2e
```

Unit tests cover services, controllers, guards, the TMDB client, sync logic, cache behaviour and edge cases (invalid input, missing resources, duplicate entries, revoked refresh tokens, concurrent-write races). Current coverage is ~98% statements.

The e2e suite boots the full application against real Postgres and Redis in a dedicated `movies_e2e` database and exercises the actual HTTP contract: cookie + bearer auth, refresh rotation (replaying a rotated token fails), cache invalidation after rating writes, cross-user rating averages, watchlist privacy and validation errors.

Both suites run in CI on every push and pull request, alongside lint and a production image build (`.github/workflows/ci.yml`).

## Database Migrations

Migrations run automatically on startup. For manual control:

```bash
npm run migration:generate -- src/database/migrations/MyChange
npm run migration:run
npm run migration:revert
```

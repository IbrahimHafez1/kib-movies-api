import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { AppCacheModule } from './cache/app-cache.module';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { GenresModule } from './genres/genres.module';
import { HealthModule } from './health/health.module';
import { MoviesModule } from './movies/movies.module';
import { RatingsModule } from './ratings/ratings.module';
import { SyncModule } from './sync/sync.module';
import { TmdbModule } from './tmdb/tmdb.module';
import { UsersModule } from './users/users.module';
import { WatchlistModule } from './watchlist/watchlist.module';

const ONE_MINUTE_MS = 60_000;
const MAX_REQUESTS_PER_MINUTE = 100;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{ ttl: ONE_MINUTE_MS, limit: MAX_REQUESTS_PER_MINUTE }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AppCacheModule,
    TmdbModule,
    SyncModule,
    GenresModule,
    MoviesModule,
    UsersModule,
    AuthModule,
    RatingsModule,
    WatchlistModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

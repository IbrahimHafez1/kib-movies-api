import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TmdbService } from './tmdb.service';

const TMDB_REQUEST_TIMEOUT_MS = 10_000;

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        baseURL: configService.getOrThrow<string>('tmdb.baseUrl'),
        timeout: TMDB_REQUEST_TIMEOUT_MS,
      }),
    }),
  ],
  providers: [TmdbService],
  exports: [TmdbService],
})
export class TmdbModule {}

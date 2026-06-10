import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Genre } from '../genres/entities/genre.entity';
import { Movie } from '../movies/entities/movie.entity';
import { TmdbModule } from '../tmdb/tmdb.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [TmdbModule, TypeOrmModule.forFeature([Genre, Movie])],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}

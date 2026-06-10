import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from '../movies/entities/movie.entity';
import { MoviesModule } from '../movies/movies.module';
import { Rating } from './entities/rating.entity';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Rating, Movie]), MoviesModule],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}

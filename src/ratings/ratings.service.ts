import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isForeignKeyViolation, isUniqueViolation } from '../common/database-errors';
import { Movie } from '../movies/entities/movie.entity';
import { MoviesService } from '../movies/movies.service';
import { RateMovieDto } from './dto/rate-movie.dto';
import { RatingResponseDto } from './dto/rating-response.dto';
import { Rating } from './entities/rating.entity';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating) private readonly ratingsRepository: Repository<Rating>,
    @InjectRepository(Movie) private readonly moviesRepository: Repository<Movie>,
    private readonly moviesService: MoviesService,
  ) {}

  /** Creates the user's rating for a movie, or updates it if one exists. */
  async rateMovie(
    userId: string,
    movieId: number,
    rateMovieDto: RateMovieDto,
  ): Promise<RatingResponseDto> {
    await this.ensureMovieExists(movieId);

    let saved: Rating;
    try {
      saved = await this.upsertRating(userId, movieId, rateMovieDto.value);
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Two concurrent first-time ratings raced; the loser retries as an update.
        saved = await this.upsertRating(userId, movieId, rateMovieDto.value);
      } else if (isForeignKeyViolation(error)) {
        // Movie was deleted between the existence check and the insert.
        throw new NotFoundException(`Movie ${movieId} not found`);
      } else {
        throw error;
      }
    }

    await this.moviesService.invalidateMovieCaches(movieId);
    return RatingResponseDto.fromEntity(saved);
  }

  async deleteRating(userId: string, movieId: number): Promise<void> {
    const result = await this.ratingsRepository.delete({ userId, movieId });
    if (!result.affected) {
      throw new NotFoundException(`No rating by this user for movie ${movieId}`);
    }
    await this.moviesService.invalidateMovieCaches(movieId);
  }

  private async upsertRating(userId: string, movieId: number, value: number): Promise<Rating> {
    const existing = await this.ratingsRepository.findOne({ where: { userId, movieId } });
    const rating = existing
      ? { ...existing, value }
      : this.ratingsRepository.create({ userId, movieId, value });
    return this.ratingsRepository.save(rating);
  }

  private async ensureMovieExists(movieId: number): Promise<void> {
    const exists = await this.moviesRepository.exists({ where: { id: movieId } });
    if (!exists) {
      throw new NotFoundException(`Movie ${movieId} not found`);
    }
  }
}

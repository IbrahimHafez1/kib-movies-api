import { ApiProperty } from '@nestjs/swagger';
import { Genre } from '../../genres/entities/genre.entity';
import { Movie } from '../entities/movie.entity';

export interface RatingStats {
  average: number;
  count: number;
}

const EMPTY_STATS: RatingStats = { average: 0, count: 0 };

export class MovieResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true, type: String })
  originalTitle: string | null;

  @ApiProperty({ nullable: true, type: String })
  overview: string | null;

  @ApiProperty({ nullable: true, type: String })
  releaseDate: string | null;

  @ApiProperty({ nullable: true, type: String })
  posterPath: string | null;

  @ApiProperty({ nullable: true, type: String })
  backdropPath: string | null;

  @ApiProperty({ nullable: true, type: String })
  originalLanguage: string | null;

  @ApiProperty()
  popularity: number;

  @ApiProperty({ description: 'Vote average as reported by TMDB' })
  tmdbVoteAverage: number;

  @ApiProperty({ description: 'Vote count as reported by TMDB' })
  tmdbVoteCount: number;

  @ApiProperty({ isArray: true, type: Genre })
  genres: Genre[];

  @ApiProperty({ description: 'Average of user ratings submitted to this API (0 when unrated)' })
  averageRating: number;

  @ApiProperty({ description: 'Number of user ratings submitted to this API' })
  ratingCount: number;

  static fromEntity(movie: Movie, stats: RatingStats = EMPTY_STATS): MovieResponseDto {
    return {
      id: movie.id,
      title: movie.title,
      originalTitle: movie.originalTitle,
      overview: movie.overview,
      releaseDate: movie.releaseDate,
      posterPath: movie.posterPath,
      backdropPath: movie.backdropPath,
      originalLanguage: movie.originalLanguage,
      popularity: movie.popularity,
      tmdbVoteAverage: movie.tmdbVoteAverage,
      tmdbVoteCount: movie.tmdbVoteCount,
      genres: movie.genres ?? [],
      averageRating: stats.average,
      ratingCount: stats.count,
    };
  }
}

import { ApiProperty } from '@nestjs/swagger';
import { Genre } from '../../genres/entities/genre.entity';
import { Movie } from '../entities/movie.entity';

export interface RatingStats {
  average: number;
  count: number;
}

const EMPTY_STATS: RatingStats = { average: 0, count: 0 };

export class MovieResponseDto {
  @ApiProperty({ description: 'TMDB movie id', example: 603 })
  id: number;

  @ApiProperty({ example: 'The Matrix' })
  title: string;

  @ApiProperty({ nullable: true, type: String, example: 'The Matrix' })
  originalTitle: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'A hacker discovers that reality is a simulation.',
  })
  overview: string | null;

  @ApiProperty({ nullable: true, type: String, example: '1999-03-31' })
  releaseDate: string | null;

  @ApiProperty({ nullable: true, type: String, example: '/p96dm7sCMn4VYAStA6siNz30G1r.jpg' })
  posterPath: string | null;

  @ApiProperty({ nullable: true, type: String, example: '/icmmfXiqwiryeg1mD3YgSQ4dGm6.jpg' })
  backdropPath: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'en' })
  originalLanguage: string | null;

  @ApiProperty({ example: 85.5 })
  popularity: number;

  @ApiProperty({ description: 'Vote average as reported by TMDB', example: 8.2 })
  tmdbVoteAverage: number;

  @ApiProperty({ description: 'Vote count as reported by TMDB', example: 26512 })
  tmdbVoteCount: number;

  @ApiProperty({ isArray: true, type: Genre })
  genres: Genre[];

  @ApiProperty({
    description: 'Average of user ratings submitted to this API (0 when unrated)',
    example: 8.5,
  })
  averageRating: number;

  @ApiProperty({ description: 'Number of user ratings submitted to this API', example: 2 })
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

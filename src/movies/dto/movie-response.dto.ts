import { ApiProperty } from '@nestjs/swagger';
import { Genre } from '../../genres/entities/genre.entity';
import { Movie } from '../entities/movie.entity';

export interface RatingStats {
  average: number;
  count: number;
}

const EMPTY_STATS: RatingStats = { average: 0, count: 0 };

/** TMDB image sizes (https://developer.themoviedb.org/docs/image-basics) used for full URLs. */
const POSTER_SIZE = 'w500';
const BACKDROP_SIZE = 'w1280';

/** Builds a ready-to-use TMDB CDN URL from a stored relative path, or null when there is none. */
const buildImageUrl = (imageBaseUrl: string, size: string, path: string | null): string | null =>
  path ? `${imageBaseUrl}/${size}${path}` : null;

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

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Full poster URL on the TMDB image CDN; null when the movie has no poster',
    example: 'https://image.tmdb.org/t/p/w500/p96dm7sCMn4VYAStA6siNz30G1r.jpg',
  })
  posterUrl: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Full backdrop URL on the TMDB image CDN; null when the movie has no backdrop',
    example: 'https://image.tmdb.org/t/p/w1280/icmmfXiqwiryeg1mD3YgSQ4dGm6.jpg',
  })
  backdropUrl: string | null;

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

  static fromEntity(
    movie: Movie,
    imageBaseUrl: string,
    stats: RatingStats = EMPTY_STATS,
  ): MovieResponseDto {
    return {
      id: movie.id,
      title: movie.title,
      originalTitle: movie.originalTitle,
      overview: movie.overview,
      releaseDate: movie.releaseDate,
      posterUrl: buildImageUrl(imageBaseUrl, POSTER_SIZE, movie.posterPath),
      backdropUrl: buildImageUrl(imageBaseUrl, BACKDROP_SIZE, movie.backdropPath),
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

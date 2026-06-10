import { ApiProperty } from '@nestjs/swagger';
import { MovieResponseDto, RatingStats } from '../../movies/dto/movie-response.dto';
import { WatchlistItem } from '../entities/watchlist-item.entity';

export class WatchlistItemResponseDto {
  @ApiProperty()
  movieId: number;

  @ApiProperty()
  addedAt: Date;

  @ApiProperty({ type: MovieResponseDto })
  movie: MovieResponseDto;

  static fromEntity(item: WatchlistItem, stats?: RatingStats): WatchlistItemResponseDto {
    return {
      movieId: item.movieId,
      addedAt: item.createdAt,
      movie: MovieResponseDto.fromEntity(item.movie, stats),
    };
  }
}

import { ApiProperty } from '@nestjs/swagger';
import { Rating } from '../entities/rating.entity';

export class RatingResponseDto {
  @ApiProperty()
  movieId: number;

  @ApiProperty()
  value: number;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(rating: Rating): RatingResponseDto {
    return {
      movieId: rating.movieId,
      value: rating.value,
      updatedAt: rating.updatedAt,
    };
  }
}

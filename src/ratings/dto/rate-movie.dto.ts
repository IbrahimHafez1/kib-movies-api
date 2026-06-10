import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const MIN_RATING = 1;
export const MAX_RATING = 10;

export class RateMovieDto {
  @ApiProperty({ description: 'Score from 1 to 10', minimum: MIN_RATING, maximum: MAX_RATING })
  @Type(() => Number)
  @IsInt()
  @Min(MIN_RATING)
  @Max(MAX_RATING)
  value: number;
}

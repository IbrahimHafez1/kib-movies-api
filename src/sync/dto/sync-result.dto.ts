import { ApiProperty } from '@nestjs/swagger';

/** Counts returned by a sync run; documents the response shape in Swagger. */
export class SyncResultDto {
  @ApiProperty({ description: 'Number of genres upserted', example: 19 })
  genres: number;

  @ApiProperty({ description: 'Number of movies upserted', example: 100 })
  movies: number;
}

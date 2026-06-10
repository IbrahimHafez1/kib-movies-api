import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum MovieSortBy {
  POPULARITY = 'popularity',
  RELEASE_DATE = 'releaseDate',
  TITLE = 'title',
  AVERAGE_RATING = 'averageRating',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListMoviesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive search on the movie title' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by genre name (e.g. "Action") or TMDB genre id (e.g. 28)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  genre?: string;

  @ApiPropertyOptional({ enum: MovieSortBy, default: MovieSortBy.POPULARITY })
  @IsOptional()
  @IsEnum(MovieSortBy)
  sortBy: MovieSortBy = MovieSortBy.POPULARITY;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  order: SortOrder = SortOrder.DESC;
}

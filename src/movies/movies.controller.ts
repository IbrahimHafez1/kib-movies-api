import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { ListMoviesQueryDto } from './dto/list-movies-query.dto';
import { MovieResponseDto } from './dto/movie-response.dto';
import { MoviesService } from './movies.service';

@ApiTags('movies')
@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Get()
  @ApiOperation({
    summary: 'List movies with pagination, search, genre filtering and sorting',
    description:
      'Each movie includes the average user rating. Filter by genre name (?genre=Action) ' +
      'or TMDB genre id (?genre=28), search by title (?search=batman), sort by popularity, ' +
      'release date, title or average rating.',
  })
  @ApiOkResponse({ type: PaginatedResponseDto<MovieResponseDto> })
  findAll(@Query() query: ListMoviesQueryDto): Promise<PaginatedResponseDto<MovieResponseDto>> {
    return this.moviesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single movie by id' })
  @ApiOkResponse({ type: MovieResponseDto })
  @ApiNotFoundResponse({ description: 'Movie not found' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<MovieResponseDto> {
    return this.moviesService.findOne(id);
  }
}

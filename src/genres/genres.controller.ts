import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Genre } from './entities/genre.entity';
import { GenresService } from './genres.service';

@ApiTags('genres')
@Controller('genres')
export class GenresController {
  constructor(private readonly genresService: GenresService) {}

  @Get()
  @ApiOperation({ summary: 'List all movie genres' })
  @ApiOkResponse({ type: [Genre] })
  findAll(): Promise<Genre[]> {
    return this.genresService.findAll();
  }
}

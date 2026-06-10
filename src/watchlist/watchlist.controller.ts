import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { WatchlistItemResponseDto } from './dto/watchlist-item-response.dto';
import { WatchlistService } from './watchlist.service';

@ApiTags('watchlist')
@ApiBearerAuth()
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Missing or expired credentials' })
@UseGuards(JwtAuthGuard)
@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  @ApiOperation({ summary: "List the authenticated user's watchlist" })
  @ApiPaginatedResponse(WatchlistItemResponseDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<WatchlistItemResponseDto>> {
    return this.watchlistService.list(user.userId, query);
  }

  @Post(':movieId')
  @ApiOperation({ summary: 'Add a movie to the watchlist' })
  @ApiParam({ name: 'movieId', description: 'TMDB movie id', example: 603 })
  @ApiCreatedResponse({ type: WatchlistItemResponseDto })
  @ApiNotFoundResponse({ description: 'Movie not found' })
  @ApiConflictResponse({ description: 'Movie already in watchlist' })
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('movieId', ParseIntPipe) movieId: number,
  ): Promise<WatchlistItemResponseDto> {
    return this.watchlistService.add(user.userId, movieId);
  }

  @Delete(':movieId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a movie from the watchlist' })
  @ApiParam({ name: 'movieId', description: 'TMDB movie id', example: 603 })
  @ApiNotFoundResponse({ description: 'Movie not in watchlist' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('movieId', ParseIntPipe) movieId: number,
  ): Promise<void> {
    return this.watchlistService.remove(user.userId, movieId);
  }
}

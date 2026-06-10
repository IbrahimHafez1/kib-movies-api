import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RateMovieDto } from './dto/rate-movie.dto';
import { RatingResponseDto } from './dto/rating-response.dto';
import { RatingsService } from './ratings.service';

@ApiTags('ratings')
@ApiBearerAuth()
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Missing or expired credentials' })
@ApiParam({ name: 'movieId', description: 'TMDB movie id', example: 603 })
@UseGuards(JwtAuthGuard)
@Controller('movies/:movieId/ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Put()
  @ApiOperation({ summary: 'Rate a movie from 1 to 10 (creates or updates your rating)' })
  @ApiOkResponse({ type: RatingResponseDto })
  @ApiBadRequestResponse({ description: 'Rating must be an integer between 1 and 10' })
  @ApiNotFoundResponse({ description: 'Movie not found' })
  rateMovie(
    @CurrentUser() user: AuthenticatedUser,
    @Param('movieId', ParseIntPipe) movieId: number,
    @Body() rateMovieDto: RateMovieDto,
  ): Promise<RatingResponseDto> {
    return this.ratingsService.rateMovie(user.userId, movieId, rateMovieDto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove your rating for a movie' })
  @ApiNotFoundResponse({ description: 'Rating not found' })
  deleteRating(
    @CurrentUser() user: AuthenticatedUser,
    @Param('movieId', ParseIntPipe) movieId: number,
  ): Promise<void> {
    return this.ratingsService.deleteRating(user.userId, movieId);
  }
}

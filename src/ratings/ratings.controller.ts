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
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RateMovieDto } from './dto/rate-movie.dto';
import { RatingResponseDto } from './dto/rating-response.dto';
import { RatingsService } from './ratings.service';

@ApiTags('ratings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('movies/:movieId/ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Put()
  @ApiOperation({ summary: 'Rate a movie from 1 to 10 (creates or updates your rating)' })
  @ApiOkResponse({ type: RatingResponseDto })
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

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isForeignKeyViolation, isUniqueViolation } from '../common/database-errors';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Movie } from '../movies/entities/movie.entity';
import { MoviesService } from '../movies/movies.service';
import { WatchlistItemResponseDto } from './dto/watchlist-item-response.dto';
import { WatchlistItem } from './entities/watchlist-item.entity';

@Injectable()
export class WatchlistService {
  private readonly imageBaseUrl: string;

  constructor(
    @InjectRepository(WatchlistItem)
    private readonly watchlistRepository: Repository<WatchlistItem>,
    @InjectRepository(Movie) private readonly moviesRepository: Repository<Movie>,
    private readonly moviesService: MoviesService,
    configService: ConfigService,
  ) {
    this.imageBaseUrl = configService.getOrThrow<string>('tmdb.imageBaseUrl');
  }

  async add(userId: string, movieId: number): Promise<WatchlistItemResponseDto> {
    const movie = await this.moviesRepository.findOne({
      where: { id: movieId },
      relations: { genres: true },
    });
    if (!movie) {
      throw new NotFoundException(`Movie ${movieId} not found`);
    }

    const existing = await this.watchlistRepository.findOne({ where: { userId, movieId } });
    if (existing) {
      throw new ConflictException('Movie is already in your watchlist');
    }

    let item: WatchlistItem;
    try {
      item = await this.watchlistRepository.save(
        this.watchlistRepository.create({ userId, movieId }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        // A concurrent request won the race; report it like any other duplicate.
        throw new ConflictException('Movie is already in your watchlist');
      }
      if (isForeignKeyViolation(error)) {
        throw new NotFoundException(`Movie ${movieId} not found`);
      }
      throw error;
    }
    item.movie = movie;
    const stats = await this.moviesService.getRatingStats([movieId]);
    return WatchlistItemResponseDto.fromEntity(item, this.imageBaseUrl, stats.get(movieId));
  }

  async remove(userId: string, movieId: number): Promise<void> {
    const result = await this.watchlistRepository.delete({ userId, movieId });
    if (!result.affected) {
      throw new NotFoundException(`Movie ${movieId} is not in your watchlist`);
    }
  }

  async list(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<WatchlistItemResponseDto>> {
    const [items, totalItems] = await this.watchlistRepository.findAndCount({
      where: { userId },
      relations: { movie: { genres: true } },
      order: { createdAt: 'DESC' },
      skip: query.offset,
      take: query.limit,
    });

    const stats = await this.moviesService.getRatingStats(items.map((item) => item.movieId));
    const data = items.map((item) =>
      WatchlistItemResponseDto.fromEntity(item, this.imageBaseUrl, stats.get(item.movieId)),
    );
    return PaginatedResponseDto.of(data, totalItems, query.page, query.limit);
  }
}

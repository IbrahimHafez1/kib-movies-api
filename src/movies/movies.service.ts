import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { AppCacheService } from '../cache/app-cache.service';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Rating } from '../ratings/entities/rating.entity';
import { ListMoviesQueryDto, MovieSortBy } from './dto/list-movies-query.dto';
import { MovieResponseDto, RatingStats } from './dto/movie-response.dto';
import { Movie } from './entities/movie.entity';

export const MOVIES_CACHE_NAMESPACE = 'movies:list';

/** Average of user ratings, computed in SQL so sorting happens in the database. */
const AVERAGE_RATING_SQL =
  '(SELECT COALESCE(AVG(r.value), 0) FROM ratings r WHERE r.movie_id = movie.id)';

const SORT_COLUMNS: Record<Exclude<MovieSortBy, MovieSortBy.AVERAGE_RATING>, string> = {
  [MovieSortBy.POPULARITY]: 'movie.popularity',
  [MovieSortBy.RELEASE_DATE]: 'movie.releaseDate',
  [MovieSortBy.TITLE]: 'movie.title',
};

@Injectable()
export class MoviesService {
  private readonly cacheTtlMs: number;

  constructor(
    @InjectRepository(Movie) private readonly moviesRepository: Repository<Movie>,
    @InjectRepository(Rating) private readonly ratingsRepository: Repository<Rating>,
    private readonly cacheService: AppCacheService,
    configService: ConfigService,
  ) {
    this.cacheTtlMs = configService.getOrThrow<number>('cache.ttlMs');
  }

  async findAll(query: ListMoviesQueryDto): Promise<PaginatedResponseDto<MovieResponseDto>> {
    const cacheKey = await this.buildListCacheKey(query);
    return this.cacheService.getOrSet(cacheKey, this.cacheTtlMs, () => this.queryMovies(query));
  }

  async findOne(id: number): Promise<MovieResponseDto> {
    return this.cacheService.getOrSet(this.detailCacheKey(id), this.cacheTtlMs, async () => {
      const movie = await this.moviesRepository.findOne({
        where: { id },
        relations: { genres: true },
      });
      if (!movie) {
        throw new NotFoundException(`Movie ${id} not found`);
      }
      const stats = await this.getRatingStats([id]);
      return MovieResponseDto.fromEntity(movie, stats.get(id));
    });
  }

  /** Drops cached responses that include the given movie. Called after rating writes. */
  async invalidateMovieCaches(movieId: number): Promise<void> {
    await Promise.all([
      this.cacheService.del(this.detailCacheKey(movieId)),
      this.cacheService.bumpNamespaceVersion(MOVIES_CACHE_NAMESPACE),
    ]);
  }

  private async queryMovies(
    query: ListMoviesQueryDto,
  ): Promise<PaginatedResponseDto<MovieResponseDto>> {
    const queryBuilder = this.buildFilteredQuery(query);
    this.applySorting(queryBuilder, query);
    queryBuilder.offset(query.offset).limit(query.limit);

    const [moviesPage, totalItems] = await queryBuilder.getManyAndCount();
    const movieIds = moviesPage.map((movie) => movie.id);

    const [moviesWithGenres, stats] = await Promise.all([
      this.loadWithGenres(movieIds),
      this.getRatingStats(movieIds),
    ]);

    const data = moviesWithGenres.map((movie) =>
      MovieResponseDto.fromEntity(movie, stats.get(movie.id)),
    );
    return PaginatedResponseDto.of(data, totalItems, query.page, query.limit);
  }

  private buildFilteredQuery(query: ListMoviesQueryDto): SelectQueryBuilder<Movie> {
    const queryBuilder = this.moviesRepository.createQueryBuilder('movie');

    if (query.search) {
      queryBuilder.andWhere('movie.title ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.genre) {
      const isNumericId = /^\d+$/.test(query.genre);
      if (isNumericId) {
        queryBuilder.innerJoin('movie.genres', 'genre', 'genre.id = :genreId', {
          genreId: Number(query.genre),
        });
      } else {
        queryBuilder.innerJoin('movie.genres', 'genre', 'LOWER(genre.name) = LOWER(:genreName)', {
          genreName: query.genre,
        });
      }
    }
    return queryBuilder;
  }

  private applySorting(queryBuilder: SelectQueryBuilder<Movie>, query: ListMoviesQueryDto): void {
    if (query.sortBy === MovieSortBy.AVERAGE_RATING) {
      queryBuilder.orderBy(AVERAGE_RATING_SQL, query.order);
    } else {
      queryBuilder.orderBy(SORT_COLUMNS[query.sortBy], query.order);
    }
    // Stable tiebreaker so pagination never duplicates or skips rows.
    queryBuilder.addOrderBy('movie.id', 'ASC');
  }

  private async loadWithGenres(movieIds: number[]): Promise<Movie[]> {
    if (movieIds.length === 0) {
      return [];
    }
    const movies = await this.moviesRepository.find({
      where: { id: In(movieIds) },
      relations: { genres: true },
    });
    const moviesById = new Map(movies.map((movie) => [movie.id, movie]));
    return movieIds
      .map((id) => moviesById.get(id))
      .filter((movie): movie is Movie => movie !== undefined);
  }

  async getRatingStats(movieIds: number[]): Promise<Map<number, RatingStats>> {
    if (movieIds.length === 0) {
      return new Map();
    }
    const rows: Array<{ movieId: string; average: string; count: string }> =
      await this.ratingsRepository
        .createQueryBuilder('rating')
        .select('rating.movieId', 'movieId')
        .addSelect('COALESCE(AVG(rating.value), 0)', 'average')
        .addSelect('COUNT(*)', 'count')
        .where('rating.movieId IN (:...movieIds)', { movieIds })
        .groupBy('rating.movieId')
        .getRawMany();

    return new Map(
      rows.map((row) => [
        Number(row.movieId),
        {
          average: Math.round(Number(row.average) * 10) / 10,
          count: Number(row.count),
        },
      ]),
    );
  }

  private async buildListCacheKey(query: ListMoviesQueryDto): Promise<string> {
    const version = await this.cacheService.getNamespaceVersion(MOVIES_CACHE_NAMESPACE);
    const normalized = [
      query.page,
      query.limit,
      query.search ?? '',
      query.genre ?? '',
      query.sortBy,
      query.order,
    ].join('|');
    return `${MOVIES_CACHE_NAMESPACE}:v${version}:${normalized}`;
  }

  private detailCacheKey(movieId: number): string {
    return `movies:detail:${movieId}`;
  }
}

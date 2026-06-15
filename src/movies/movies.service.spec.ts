import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { In, Repository } from 'typeorm';
import { AppCacheService } from '../cache/app-cache.service';
import { Rating } from '../ratings/entities/rating.entity';
import { ListMoviesQueryDto, MovieSortBy, SortOrder } from './dto/list-movies-query.dto';
import { Movie } from './entities/movie.entity';
import { MoviesService } from './movies.service';

const movie = (id: number, overrides: Partial<Movie> = {}): Movie =>
  ({
    id,
    title: `Movie ${id}`,
    overview: null,
    releaseDate: null,
    posterPath: null,
    originalLanguage: 'en',
    popularity: 10,
    tmdbVoteAverage: 7,
    tmdbVoteCount: 100,
    genres: [],
    ...overrides,
  }) as Movie;

const buildQuery = (overrides: Partial<ListMoviesQueryDto> = {}): ListMoviesQueryDto =>
  Object.assign(new ListMoviesQueryDto(), overrides);

describe('MoviesService', () => {
  let moviesQueryBuilder: Record<string, jest.Mock>;
  let ratingsQueryBuilder: Record<string, jest.Mock>;
  let moviesRepository: { createQueryBuilder: jest.Mock; find: jest.Mock; findOne: jest.Mock };
  let ratingsRepository: { createQueryBuilder: jest.Mock };
  let cacheService: {
    getOrSet: jest.Mock;
    del: jest.Mock;
    getNamespaceVersion: jest.Mock;
    bumpNamespaceVersion: jest.Mock;
  };
  let service: MoviesService;

  beforeEach(() => {
    moviesQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    ratingsQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    moviesRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(moviesQueryBuilder),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    ratingsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(ratingsQueryBuilder),
    };
    cacheService = {
      getOrSet: jest.fn((_key, _ttl, factory) => factory()),
      del: jest.fn(),
      getNamespaceVersion: jest.fn().mockResolvedValue(1),
      bumpNamespaceVersion: jest.fn(),
    };
    const configService = {
      getOrThrow: jest.fn((key: string) =>
        key === 'tmdb.imageBaseUrl' ? 'https://image.tmdb.org/t/p' : 60_000,
      ),
    } as unknown as ConfigService;

    service = new MoviesService(
      moviesRepository as unknown as Repository<Movie>,
      ratingsRepository as unknown as Repository<Rating>,
      cacheService as unknown as AppCacheService,
      configService,
    );
  });

  describe('findAll', () => {
    it('returns paginated movies enriched with rating stats', async () => {
      moviesQueryBuilder.getManyAndCount.mockResolvedValue([[movie(1), movie(2)], 25]);
      moviesRepository.find.mockResolvedValue([
        movie(1, {
          genres: [{ id: 28, name: 'Action' }],
          posterPath: '/poster.jpg',
          backdropPath: '/backdrop.jpg',
        }),
        movie(2),
      ]);
      ratingsQueryBuilder.getRawMany.mockResolvedValue([
        { movieId: '1', average: '8.25', count: '4' },
      ]);

      const result = await service.findAll(buildQuery());

      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        totalItems: 25,
        totalPages: 2,
        hasNextPage: true,
      });
      expect(result.data[0]).toMatchObject({
        id: 1,
        averageRating: 8.3,
        ratingCount: 4,
        genres: [{ id: 28, name: 'Action' }],
        posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
      });
      // A movie with no poster/backdrop yields null URLs rather than a broken link.
      expect(result.data[1]).toMatchObject({
        id: 2,
        averageRating: 0,
        ratingCount: 0,
        posterUrl: null,
        backdropUrl: null,
      });
    });

    it('applies the title search filter', async () => {
      await service.findAll(buildQuery({ search: 'matrix' }));

      expect(moviesQueryBuilder.andWhere).toHaveBeenCalledWith('movie.title ILIKE :search', {
        search: '%matrix%',
      });
    });

    it('filters by genre name case-insensitively', async () => {
      await service.findAll(buildQuery({ genre: 'Action' }));

      expect(moviesQueryBuilder.innerJoin).toHaveBeenCalledWith(
        'movie.genres',
        'genre',
        'LOWER(genre.name) = LOWER(:genreName)',
        { genreName: 'Action' },
      );
    });

    it('filters by numeric TMDB genre id', async () => {
      await service.findAll(buildQuery({ genre: '28' }));

      expect(moviesQueryBuilder.innerJoin).toHaveBeenCalledWith(
        'movie.genres',
        'genre',
        'genre.id = :genreId',
        { genreId: 28 },
      );
    });

    it('sorts by a column with a stable id tiebreaker', async () => {
      await service.findAll(buildQuery({ sortBy: MovieSortBy.TITLE, order: SortOrder.ASC }));

      expect(moviesQueryBuilder.orderBy).toHaveBeenCalledWith('movie.title', 'ASC');
      expect(moviesQueryBuilder.addOrderBy).toHaveBeenCalledWith('movie.id', 'ASC');
    });

    it('sorts by average user rating via a SQL subquery', async () => {
      await service.findAll(buildQuery({ sortBy: MovieSortBy.AVERAGE_RATING }));

      expect(moviesQueryBuilder.orderBy).toHaveBeenCalledWith(
        expect.stringContaining('AVG(r.value)'),
        'DESC',
      );
    });

    it('applies pagination offsets', async () => {
      await service.findAll(buildQuery({ page: 3, limit: 10 }));

      expect(moviesQueryBuilder.offset).toHaveBeenCalledWith(20);
      expect(moviesQueryBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('skips follow-up queries for an empty page', async () => {
      const result = await service.findAll(buildQuery({ page: 99 }));

      expect(result.data).toEqual([]);
      expect(moviesRepository.find).not.toHaveBeenCalled();
      expect(ratingsRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('builds a versioned cache key so lists can be invalidated in O(1)', async () => {
      cacheService.getNamespaceVersion.mockResolvedValue(5);

      await service.findAll(buildQuery({ search: 'matrix' }));

      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        'movies:list:v5:1|20|matrix||popularity|DESC',
        60_000,
        expect.any(Function),
      );
    });
  });

  describe('findOne', () => {
    it('returns the movie with genres and rating stats', async () => {
      moviesRepository.findOne.mockResolvedValue(
        movie(603, { genres: [{ id: 28, name: 'Action' }] }),
      );
      ratingsQueryBuilder.getRawMany.mockResolvedValue([
        { movieId: '603', average: '7', count: '1' },
      ]);

      const result = await service.findOne(603);

      expect(result).toMatchObject({ id: 603, averageRating: 7, ratingCount: 1 });
      expect(moviesRepository.findOne).toHaveBeenCalledWith({
        where: { id: 603 },
        relations: { genres: true },
      });
    });

    it('throws NotFoundException for an unknown movie', async () => {
      moviesRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('invalidateMovieCaches', () => {
    it('drops the detail key and bumps the list namespace version', async () => {
      await service.invalidateMovieCaches(603);

      expect(cacheService.del).toHaveBeenCalledWith('movies:detail:603');
      expect(cacheService.bumpNamespaceVersion).toHaveBeenCalledWith('movies:list');
    });
  });

  describe('getRatingStats', () => {
    it('returns an empty map for no ids', async () => {
      await expect(service.getRatingStats([])).resolves.toEqual(new Map());
    });

    it('aggregates rounded averages and counts per movie', async () => {
      ratingsQueryBuilder.getRawMany.mockResolvedValue([
        { movieId: '1', average: '7.6666', count: '3' },
      ]);

      const stats = await service.getRatingStats([1]);

      expect(stats.get(1)).toEqual({ average: 7.7, count: 3 });
      expect(ratingsQueryBuilder.where).toHaveBeenCalledWith('rating.movieId IN (:...movieIds)', {
        movieIds: [1],
      });
    });
  });

  it('loads genre relations preserving the sorted page order', async () => {
    moviesQueryBuilder.getManyAndCount.mockResolvedValue([[movie(2), movie(1)], 2]);
    moviesRepository.find.mockResolvedValue([movie(1), movie(2)]);

    const result = await service.findAll(buildQuery());

    expect(result.data.map((item) => item.id)).toEqual([2, 1]);
    expect(moviesRepository.find).toHaveBeenCalledWith({
      where: { id: In([2, 1]) },
      relations: { genres: true },
    });
  });
});

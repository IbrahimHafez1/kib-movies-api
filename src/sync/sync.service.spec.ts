import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AppCacheService } from '../cache/app-cache.service';
import { Genre } from '../genres/entities/genre.entity';
import { Movie } from '../movies/entities/movie.entity';
import { TmdbMovie } from '../tmdb/interfaces/tmdb.interfaces';
import { TmdbService } from '../tmdb/tmdb.service';
import { SyncService } from './sync.service';

const tmdbMovie = (id: number, overrides: Partial<TmdbMovie> = {}): TmdbMovie => ({
  id,
  title: `Movie ${id}`,
  original_title: `Movie ${id}`,
  overview: 'Overview',
  release_date: '2020-01-01',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  original_language: 'en',
  popularity: 10,
  vote_average: 7.5,
  vote_count: 100,
  genre_ids: [28],
  ...overrides,
});

describe('SyncService', () => {
  let tmdbService: {
    isConfigured: boolean;
    fetchGenres: jest.Mock;
    fetchPopularMovies: jest.Mock;
    fetchChangedMovieIds: jest.Mock;
    fetchMovieDetails: jest.Mock;
  };
  let genresRepository: { save: jest.Mock; create: jest.Mock; findBy: jest.Mock };
  let moviesRepository: { save: jest.Mock; create: jest.Mock; count: jest.Mock; find: jest.Mock };
  let cacheService: { del: jest.Mock; bumpNamespaceVersion: jest.Mock };
  let service: SyncService;

  const createService = (syncPages = 2): SyncService => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(syncPages),
    } as unknown as ConfigService;
    return new SyncService(
      tmdbService as unknown as TmdbService,
      genresRepository as unknown as Repository<Genre>,
      moviesRepository as unknown as Repository<Movie>,
      cacheService as unknown as AppCacheService,
      configService,
    );
  };

  beforeEach(() => {
    tmdbService = {
      isConfigured: true,
      fetchGenres: jest.fn().mockResolvedValue([{ id: 28, name: 'Action' }]),
      fetchPopularMovies: jest.fn(),
      fetchChangedMovieIds: jest.fn(),
      fetchMovieDetails: jest.fn(),
    };
    genresRepository = {
      save: jest.fn((genres) => genres),
      create: jest.fn((genre) => genre),
      findBy: jest.fn().mockResolvedValue([{ id: 28, name: 'Action' }]),
    };
    moviesRepository = {
      save: jest.fn(),
      create: jest.fn((movie) => movie),
      count: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    cacheService = { del: jest.fn(), bumpNamespaceVersion: jest.fn() };
    service = createService();
  });

  describe('syncAll', () => {
    it('skips entirely when no TMDB key is configured', async () => {
      tmdbService.isConfigured = false;

      await expect(service.syncAll()).resolves.toEqual({ genres: 0, movies: 0 });
      expect(tmdbService.fetchGenres).not.toHaveBeenCalled();
    });

    it('syncs genres and the configured number of movie pages', async () => {
      tmdbService.fetchPopularMovies.mockResolvedValue({
        page: 1,
        results: [tmdbMovie(1), tmdbMovie(2)],
        total_pages: 50,
        total_results: 1000,
      });

      await expect(service.syncAll()).resolves.toEqual({ genres: 1, movies: 4 });
      expect(tmdbService.fetchPopularMovies).toHaveBeenCalledTimes(2);
      expect(genresRepository.save).toHaveBeenCalled();
      expect(moviesRepository.save).toHaveBeenCalledTimes(2);
    });

    it('invalidates cached genre and movie reads after syncing', async () => {
      tmdbService.fetchPopularMovies.mockResolvedValue({
        page: 1,
        results: [tmdbMovie(1)],
        total_pages: 1,
        total_results: 1,
      });

      await service.syncAll();

      expect(cacheService.del).toHaveBeenCalledWith('genres:all');
      expect(cacheService.bumpNamespaceVersion).toHaveBeenCalledWith('movies:list');
    });

    it('maps TMDB payloads onto entities, attaching known genres', async () => {
      tmdbService.fetchPopularMovies.mockResolvedValue({
        page: 1,
        results: [tmdbMovie(1, { genre_ids: [28, 999] })],
        total_pages: 1,
        total_results: 1,
      });

      await service.syncAll();

      const savedMovies = moviesRepository.save.mock.calls[0][0];
      expect(savedMovies[0]).toMatchObject({
        id: 1,
        title: 'Movie 1',
        tmdbVoteAverage: 7.5,
        genres: [{ id: 28, name: 'Action' }],
      });
    });

    it('stops paging when TMDB has fewer pages than configured', async () => {
      tmdbService.fetchPopularMovies.mockResolvedValue({
        page: 1,
        results: [tmdbMovie(1)],
        total_pages: 1,
        total_results: 1,
      });

      await service.syncAll();

      expect(tmdbService.fetchPopularMovies).toHaveBeenCalledTimes(1);
    });

    it('handles an empty results page', async () => {
      tmdbService.fetchPopularMovies.mockResolvedValue({
        page: 1,
        results: [],
        total_pages: 1,
        total_results: 0,
      });

      await expect(service.syncAll()).resolves.toEqual({ genres: 1, movies: 0 });
      expect(moviesRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('syncChangedMovies', () => {
    const movieDetails = (id: number) => ({
      id,
      title: `Movie ${id}`,
      original_title: `Movie ${id}`,
      overview: 'Updated overview',
      release_date: '2020-01-01',
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
      original_language: 'en',
      popularity: 50,
      vote_average: 8,
      vote_count: 500,
      genres: [{ id: 28, name: 'Action' }],
    });

    it('skips when no TMDB key is configured', async () => {
      tmdbService.isConfigured = false;

      await expect(service.syncChangedMovies()).resolves.toBe(0);
      expect(tmdbService.fetchChangedMovieIds).not.toHaveBeenCalled();
    });

    it('skips when no movies are tracked yet', async () => {
      moviesRepository.find.mockResolvedValue([]);

      await expect(service.syncChangedMovies()).resolves.toBe(0);
      expect(tmdbService.fetchChangedMovieIds).not.toHaveBeenCalled();
    });

    it('refreshes only tracked movies that appear in the changes feed', async () => {
      moviesRepository.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      tmdbService.fetchChangedMovieIds.mockResolvedValue({
        page: 1,
        results: [{ id: 1 }, { id: 999 }],
        total_pages: 1,
        total_results: 2,
      });
      tmdbService.fetchMovieDetails.mockResolvedValue(movieDetails(1));

      await expect(service.syncChangedMovies()).resolves.toBe(1);

      expect(tmdbService.fetchChangedMovieIds).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        1,
      );
      expect(tmdbService.fetchMovieDetails).toHaveBeenCalledTimes(1);
      expect(tmdbService.fetchMovieDetails).toHaveBeenCalledWith(1);
      expect(moviesRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, genres: [{ id: 28, name: 'Action' }] }),
      );
      expect(cacheService.bumpNamespaceVersion).toHaveBeenCalledWith('movies:list');
    });

    it('walks every page of the changes feed', async () => {
      moviesRepository.find.mockResolvedValue([{ id: 1 }]);
      tmdbService.fetchChangedMovieIds
        .mockResolvedValueOnce({ page: 1, results: [], total_pages: 2, total_results: 120 })
        .mockResolvedValueOnce({
          page: 2,
          results: [{ id: 1 }],
          total_pages: 2,
          total_results: 120,
        });
      tmdbService.fetchMovieDetails.mockResolvedValue(movieDetails(1));

      await expect(service.syncChangedMovies()).resolves.toBe(1);
      expect(tmdbService.fetchChangedMovieIds).toHaveBeenCalledTimes(2);
    });

    it('continues when refreshing a single movie fails', async () => {
      moviesRepository.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      tmdbService.fetchChangedMovieIds.mockResolvedValue({
        page: 1,
        results: [{ id: 1 }, { id: 2 }],
        total_pages: 1,
        total_results: 2,
      });
      tmdbService.fetchMovieDetails
        .mockRejectedValueOnce(new Error('removed from TMDB'))
        .mockResolvedValueOnce(movieDetails(2));

      await expect(service.syncChangedMovies()).resolves.toBe(1);
      expect(moviesRepository.save).toHaveBeenCalledTimes(1);
    });

    it('leaves caches untouched when nothing relevant changed', async () => {
      moviesRepository.find.mockResolvedValue([{ id: 1 }]);
      tmdbService.fetchChangedMovieIds.mockResolvedValue({
        page: 1,
        results: [{ id: 999 }],
        total_pages: 1,
        total_results: 1,
      });

      await expect(service.syncChangedMovies()).resolves.toBe(0);
      expect(cacheService.bumpNamespaceVersion).not.toHaveBeenCalled();
    });
  });

  describe('handleIncrementalSync', () => {
    it('runs the incremental sync', async () => {
      const syncSpy = jest.spyOn(service, 'syncChangedMovies').mockResolvedValue(3);

      await service.handleIncrementalSync();

      expect(syncSpy).toHaveBeenCalled();
    });

    it('swallows failures so the scheduler keeps running', async () => {
      jest.spyOn(service, 'syncChangedMovies').mockRejectedValue(new Error('tmdb down'));

      await expect(service.handleIncrementalSync()).resolves.toBeUndefined();
    });
  });

  describe('onApplicationBootstrap', () => {
    it('skips the initial sync when movies already exist', async () => {
      moviesRepository.count.mockResolvedValue(42);
      const syncSpy = jest.spyOn(service, 'syncAll');

      await service.onApplicationBootstrap();

      expect(syncSpy).not.toHaveBeenCalled();
    });

    it('triggers a sync when the database is empty', async () => {
      moviesRepository.count.mockResolvedValue(0);
      const syncSpy = jest.spyOn(service, 'syncAll').mockResolvedValue({ genres: 0, movies: 0 });

      await service.onApplicationBootstrap();

      expect(syncSpy).toHaveBeenCalled();
    });

    it('logs instead of crashing when the initial sync fails', async () => {
      moviesRepository.count.mockResolvedValue(0);
      jest.spyOn(service, 'syncAll').mockRejectedValue(new Error('tmdb down'));

      await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    });
  });

  describe('handleScheduledSync', () => {
    it('runs a full sync', async () => {
      const syncSpy = jest.spyOn(service, 'syncAll').mockResolvedValue({ genres: 1, movies: 2 });

      await service.handleScheduledSync();

      expect(syncSpy).toHaveBeenCalled();
    });

    it('swallows sync failures so the scheduler keeps running', async () => {
      jest.spyOn(service, 'syncAll').mockRejectedValue(new Error('tmdb down'));

      await expect(service.handleScheduledSync()).resolves.toBeUndefined();
    });
  });
});

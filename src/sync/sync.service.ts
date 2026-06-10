import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppCacheService } from '../cache/app-cache.service';
import { Genre } from '../genres/entities/genre.entity';
import { GENRES_CACHE_KEY } from '../genres/genres.service';
import { Movie } from '../movies/entities/movie.entity';
import { MOVIES_CACHE_NAMESPACE } from '../movies/movies.service';
import { TmdbService } from '../tmdb/tmdb.service';
import { TmdbMovie, TmdbMovieBase, TmdbMovieDetails } from '../tmdb/interfaces/tmdb.interfaces';

export interface SyncResult {
  genres: number;
  movies: number;
}

/** Window the incremental sync looks back over; generous to absorb missed runs. */
const CHANGES_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/** Hard cap on changes-feed pages per run; a runaway feed must not starve the app. */
const MAX_CHANGE_PAGES = 50;

/**
 * Keeps the local database in sync with TMDB.
 *
 * Sync is upsert-based (TMDB ids are reused as primary keys), so it can run
 * repeatedly, pick up new data, and scale to more pages or additional
 * resources without schema or logic changes.
 *
 * Two complementary jobs run on a schedule:
 * - a daily full sync that refreshes genres and the popular-movie set, and
 * - an incremental sync that polls TMDB's changes feed (TMDB has no
 *   webhooks) and refreshes only tracked movies that actually changed.
 */
@Injectable()
export class SyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SyncService.name);
  private readonly pagesToSync: number;

  constructor(
    private readonly tmdbService: TmdbService,
    @InjectRepository(Genre) private readonly genresRepository: Repository<Genre>,
    @InjectRepository(Movie) private readonly moviesRepository: Repository<Movie>,
    private readonly cacheService: AppCacheService,
    configService: ConfigService,
  ) {
    this.pagesToSync = configService.getOrThrow<number>('tmdb.syncPages');
  }

  /** Seeds an empty database on first boot without blocking startup. */
  async onApplicationBootstrap(): Promise<void> {
    const movieCount = await this.moviesRepository.count();
    if (movieCount > 0) {
      this.logger.log(`Database already populated (${movieCount} movies); skipping initial sync`);
      return;
    }
    void this.syncAll().catch((error) =>
      this.logger.error(`Initial sync failed: ${(error as Error).message}`),
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleScheduledSync(): Promise<void> {
    try {
      await this.syncAll();
    } catch (error) {
      this.logger.error(`Scheduled sync failed: ${(error as Error).message}`);
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async handleIncrementalSync(): Promise<void> {
    try {
      await this.syncChangedMovies();
    } catch (error) {
      this.logger.error(`Incremental sync failed: ${(error as Error).message}`);
    }
  }

  async syncAll(): Promise<SyncResult> {
    if (!this.tmdbService.isConfigured) {
      this.logger.warn('TMDB_API_KEY is not set; skipping sync. Set it to populate the database.');
      return { genres: 0, movies: 0 };
    }

    const genresSynced = await this.syncGenres();
    const moviesSynced = await this.syncPopularMovies();
    await this.invalidateReadCaches();
    this.logger.log(`Sync complete: ${genresSynced} genres, ${moviesSynced} movies`);
    return { genres: genresSynced, movies: moviesSynced };
  }

  /**
   * Near-realtime freshness without webhooks: polls TMDB's changes feed
   * and refreshes only the movies this database tracks. Cheap enough to
   * run frequently — a run with no relevant changes costs a handful of
   * id-only requests.
   */
  async syncChangedMovies(): Promise<number> {
    if (!this.tmdbService.isConfigured) {
      this.logger.warn('TMDB_API_KEY is not set; skipping incremental sync.');
      return 0;
    }
    const trackedIds = new Set(
      (await this.moviesRepository.find({ select: { id: true } })).map((movie) => movie.id),
    );
    if (trackedIds.size === 0) {
      return 0;
    }

    const startDate = new Date(Date.now() - CHANGES_LOOKBACK_MS).toISOString().slice(0, 10);
    let refreshed = 0;
    for (let page = 1; page <= MAX_CHANGE_PAGES; page++) {
      const changes = await this.tmdbService.fetchChangedMovieIds(startDate, page);
      const trackedChangedIds = changes.results
        .map((change) => change.id)
        .filter((id) => trackedIds.has(id));
      refreshed += await this.refreshMovies(trackedChangedIds);
      if (page >= changes.total_pages) {
        break;
      }
    }

    if (refreshed > 0) {
      await this.invalidateReadCaches();
    }
    this.logger.log(`Incremental sync complete: ${refreshed} tracked movies refreshed`);
    return refreshed;
  }

  /** Synced data changes list contents, so cached reads must not outlive it. */
  private async invalidateReadCaches(): Promise<void> {
    await Promise.all([
      this.cacheService.del(GENRES_CACHE_KEY),
      this.cacheService.bumpNamespaceVersion(MOVIES_CACHE_NAMESPACE),
    ]);
  }

  private async syncGenres(): Promise<number> {
    const tmdbGenres = await this.tmdbService.fetchGenres();
    await this.genresRepository.save(
      tmdbGenres.map((genre) => this.genresRepository.create({ id: genre.id, name: genre.name })),
    );
    return tmdbGenres.length;
  }

  private async syncPopularMovies(): Promise<number> {
    let totalSynced = 0;
    for (let page = 1; page <= this.pagesToSync; page++) {
      const response = await this.tmdbService.fetchPopularMovies(page);
      await this.upsertMovies(response.results);
      totalSynced += response.results.length;
      if (page >= response.total_pages) {
        break;
      }
    }
    return totalSynced;
  }

  private async refreshMovies(movieIds: number[]): Promise<number> {
    let refreshed = 0;
    for (const movieId of movieIds) {
      try {
        const details = await this.tmdbService.fetchMovieDetails(movieId);
        await this.upsertFromDetails(details);
        refreshed++;
      } catch {
        // One movie failing (e.g. removed from TMDB) must not abort the run.
        this.logger.warn(`Skipping refresh of movie ${movieId}; TMDB request failed`);
      }
    }
    return refreshed;
  }

  private async upsertMovies(tmdbMovies: TmdbMovie[]): Promise<number> {
    if (tmdbMovies.length === 0) {
      return 0;
    }
    const genreIds = [...new Set(tmdbMovies.flatMap((movie) => movie.genre_ids ?? []))];
    const knownGenres = await this.genresRepository.findBy({ id: In(genreIds) });
    const genresById = new Map(knownGenres.map((genre) => [genre.id, genre]));

    const movies = tmdbMovies.map((tmdbMovie) =>
      this.toMovieEntity(
        tmdbMovie,
        (tmdbMovie.genre_ids ?? [])
          .map((genreId) => genresById.get(genreId))
          .filter((genre): genre is Genre => genre !== undefined),
      ),
    );
    await this.moviesRepository.save(movies);
    return movies.length;
  }

  private async upsertFromDetails(details: TmdbMovieDetails): Promise<void> {
    // Detail payloads embed full genre objects, so unseen genres can be
    // upserted on the spot instead of being dropped.
    const genres = await this.genresRepository.save(
      (details.genres ?? []).map((genre) => this.genresRepository.create(genre)),
    );
    await this.moviesRepository.save(this.toMovieEntity(details, genres));
  }

  private toMovieEntity(source: TmdbMovieBase, genres: Genre[]): Movie {
    return this.moviesRepository.create({
      id: source.id,
      title: source.title,
      originalTitle: source.original_title,
      overview: source.overview,
      releaseDate: source.release_date || null,
      posterPath: source.poster_path,
      backdropPath: source.backdrop_path,
      originalLanguage: source.original_language,
      popularity: source.popularity,
      tmdbVoteAverage: source.vote_average,
      tmdbVoteCount: source.vote_count,
      genres,
    });
  }
}

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
import { TmdbMovie } from '../tmdb/interfaces/tmdb.interfaces';

export interface SyncResult {
  genres: number;
  movies: number;
}

/**
 * Keeps the local database in sync with TMDB.
 *
 * Sync is upsert-based (TMDB ids are reused as primary keys), so it can run
 * repeatedly, pick up new data, and scale to more pages or additional
 * resources without schema or logic changes.
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

  private async upsertMovies(tmdbMovies: TmdbMovie[]): Promise<number> {
    if (tmdbMovies.length === 0) {
      return 0;
    }
    const genreIds = [...new Set(tmdbMovies.flatMap((movie) => movie.genre_ids ?? []))];
    const knownGenres = await this.genresRepository.findBy({ id: In(genreIds) });
    const genresById = new Map(knownGenres.map((genre) => [genre.id, genre]));

    const movies = tmdbMovies.map((tmdbMovie) =>
      this.moviesRepository.create({
        id: tmdbMovie.id,
        title: tmdbMovie.title,
        originalTitle: tmdbMovie.original_title,
        overview: tmdbMovie.overview,
        releaseDate: tmdbMovie.release_date || null,
        posterPath: tmdbMovie.poster_path,
        backdropPath: tmdbMovie.backdrop_path,
        originalLanguage: tmdbMovie.original_language,
        popularity: tmdbMovie.popularity,
        tmdbVoteAverage: tmdbMovie.vote_average,
        tmdbVoteCount: tmdbMovie.vote_count,
        genres: (tmdbMovie.genre_ids ?? [])
          .map((genreId) => genresById.get(genreId))
          .filter((genre): genre is Genre => genre !== undefined),
      }),
    );
    await this.moviesRepository.save(movies);
    return movies.length;
  }
}

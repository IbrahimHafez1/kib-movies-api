import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  TmdbChangedMovie,
  TmdbGenre,
  TmdbGenreListResponse,
  TmdbMovie,
  TmdbMovieDetails,
  TmdbPaginatedResponse,
} from './interfaces/tmdb.interfaces';

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;

/**
 * Thin, typed client around the TMDB v3 REST API.
 * All TMDB knowledge (endpoints, auth, payload shapes) lives here so the
 * rest of the application only deals with domain types.
 */
@Injectable()
export class TmdbService {
  private readonly logger = new Logger(TmdbService.name);
  private readonly apiKey: string;
  /**
   * TMDB issues two credential types: a 32-char hex "API Key" (v3, sent as
   * the api_key query param) and a JWT "API Read Access Token" (sent as a
   * Bearer header — TMDB's preferred method). JWTs contain dots, v3 keys
   * never do, so either credential can be dropped into TMDB_API_KEY.
   */
  private readonly usesBearerToken: boolean;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    this.apiKey = configService.get<string>('tmdb.apiKey', '');
    this.usesBearerToken = this.apiKey.includes('.');
  }

  /** Whether an API key is configured; sync is skipped when it is not. */
  get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async fetchGenres(): Promise<TmdbGenre[]> {
    const response = await this.request<TmdbGenreListResponse>('/genre/movie/list');
    return response.genres;
  }

  async fetchPopularMovies(page: number): Promise<TmdbPaginatedResponse<TmdbMovie>> {
    return this.request<TmdbPaginatedResponse<TmdbMovie>>('/movie/popular', { page });
  }

  /**
   * TMDB's changes feed: ids of movies modified since the given date.
   * TMDB offers no webhooks, so this feed is the closest thing to a
   * realtime signal it provides.
   */
  async fetchChangedMovieIds(
    startDate: string,
    page: number,
  ): Promise<TmdbPaginatedResponse<TmdbChangedMovie>> {
    return this.request<TmdbPaginatedResponse<TmdbChangedMovie>>('/movie/changes', {
      start_date: startDate,
      page,
    });
  }

  async fetchMovieDetails(movieId: number): Promise<TmdbMovieDetails> {
    return this.request<TmdbMovieDetails>(`/movie/${movieId}`);
  }

  /**
   * Performs a GET with retries on transient failures (network errors,
   * 5xx, 429) using exponential backoff. Client errors fail immediately:
   * retrying a bad API key will never succeed.
   */
  private async request<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.get<T>(path, this.requestConfig(params)),
        );
        return response.data;
      } catch (error) {
        const status = error instanceof AxiosError ? error.response?.status : undefined;
        if (this.isRetryable(status) && attempt < MAX_ATTEMPTS) {
          this.logger.warn(
            `TMDB request failed (status: ${status ?? 'network error'}); ` +
              `retrying GET ${path} (attempt ${attempt + 1}/${MAX_ATTEMPTS})`,
          );
          await this.sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }
        this.logger.error(`TMDB request failed: GET ${path} (status: ${status ?? 'unknown'})`);
        throw new ServiceUnavailableException('TMDB API is unavailable');
      }
    }
  }

  private requestConfig(params: Record<string, unknown>): {
    params: Record<string, unknown>;
    headers?: Record<string, string>;
  } {
    if (this.usesBearerToken) {
      return { params, headers: { Authorization: `Bearer ${this.apiKey}` } };
    }
    return { params: { ...params, api_key: this.apiKey } };
  }

  private isRetryable(status: number | undefined): boolean {
    return status === undefined || status === HTTP_TOO_MANY_REQUESTS || status >= HTTP_SERVER_ERROR;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

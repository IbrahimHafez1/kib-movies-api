import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  TmdbGenre,
  TmdbGenreListResponse,
  TmdbMovie,
  TmdbPaginatedResponse,
} from './interfaces/tmdb.interfaces';

/**
 * Thin, typed client around the TMDB v3 REST API.
 * All TMDB knowledge (endpoints, auth, payload shapes) lives here so the
 * rest of the application only deals with domain types.
 */
@Injectable()
export class TmdbService {
  private readonly logger = new Logger(TmdbService.name);
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    this.apiKey = configService.get<string>('tmdb.apiKey', '');
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

  private async request<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<T>(path, { params: { ...params, api_key: this.apiKey } }),
      );
      return response.data;
    } catch (error) {
      const status = error instanceof AxiosError ? error.response?.status : undefined;
      this.logger.error(`TMDB request failed: GET ${path} (status: ${status ?? 'unknown'})`);
      throw new ServiceUnavailableException('TMDB API is unavailable');
    }
  }
}

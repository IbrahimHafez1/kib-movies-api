import { HttpService } from '@nestjs/axios';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { TmdbService } from './tmdb.service';

describe('TmdbService', () => {
  let httpService: jest.Mocked<Pick<HttpService, 'get'>>;

  const createService = (apiKey: string): TmdbService => {
    const configService = {
      get: jest.fn().mockReturnValue(apiKey),
    } as unknown as ConfigService;
    const service = new TmdbService(httpService as unknown as HttpService, configService);
    // Backoff delays are irrelevant to behaviour under test.
    jest.spyOn(service as never, 'sleep').mockResolvedValue(undefined as never);
    return service;
  };

  const asResponse = <T>(data: T) => of({ data } as AxiosResponse<T>);

  const axiosErrorWithStatus = (status: number): AxiosError => {
    const error = new AxiosError('Request failed');
    error.response = { status } as AxiosResponse;
    return error;
  };

  beforeEach(() => {
    httpService = { get: jest.fn() };
  });

  it('reports whether an API key is configured', () => {
    expect(createService('key').isConfigured).toBe(true);
    expect(createService('').isConfigured).toBe(false);
  });

  it('fetches genres and unwraps the list', async () => {
    const genres = [{ id: 28, name: 'Action' }];
    httpService.get.mockReturnValue(asResponse({ genres }));

    await expect(createService('key').fetchGenres()).resolves.toEqual(genres);
    expect(httpService.get).toHaveBeenCalledWith('/genre/movie/list', {
      params: { api_key: 'key' },
    });
  });

  it('fetches popular movies for a page', async () => {
    const payload = { page: 2, results: [], total_pages: 10, total_results: 200 };
    httpService.get.mockReturnValue(asResponse(payload));

    await expect(createService('key').fetchPopularMovies(2)).resolves.toEqual(payload);
    expect(httpService.get).toHaveBeenCalledWith('/movie/popular', {
      params: { page: 2, api_key: 'key' },
    });
  });

  it('sends a JWT read access token as a Bearer header instead of a query param', async () => {
    const payload = { genres: [] };
    httpService.get.mockReturnValue(asResponse(payload));
    const readAccessToken = 'eyJhbGciOiJIUzI1NiJ9.payload.signature';

    await expect(createService(readAccessToken).fetchGenres()).resolves.toEqual([]);
    expect(httpService.get).toHaveBeenCalledWith('/genre/movie/list', {
      params: {},
      headers: { Authorization: `Bearer ${readAccessToken}` },
    });
  });

  it('fetches the changes feed for a date window', async () => {
    const payload = {
      page: 1,
      results: [{ id: 603, adult: false }],
      total_pages: 1,
      total_results: 1,
    };
    httpService.get.mockReturnValue(asResponse(payload));

    await expect(createService('key').fetchChangedMovieIds('2026-06-09', 1)).resolves.toEqual(
      payload,
    );
    expect(httpService.get).toHaveBeenCalledWith('/movie/changes', {
      params: { start_date: '2026-06-09', page: 1, api_key: 'key' },
    });
  });

  it('fetches full movie details by id', async () => {
    const payload = { id: 603, title: 'The Matrix', genres: [{ id: 28, name: 'Action' }] };
    httpService.get.mockReturnValue(asResponse(payload));

    await expect(createService('key').fetchMovieDetails(603)).resolves.toEqual(payload);
    expect(httpService.get).toHaveBeenCalledWith('/movie/603', { params: { api_key: 'key' } });
  });

  it('retries transient server errors and succeeds', async () => {
    const payload = { page: 1, results: [], total_pages: 1, total_results: 0 };
    httpService.get
      .mockReturnValueOnce(throwError(() => axiosErrorWithStatus(503)))
      .mockReturnValueOnce(throwError(() => new Error('socket hang up')))
      .mockReturnValueOnce(asResponse(payload));

    await expect(createService('key').fetchPopularMovies(1)).resolves.toEqual(payload);
    expect(httpService.get).toHaveBeenCalledTimes(3);
  });

  it('gives up after exhausting retries', async () => {
    httpService.get.mockReturnValue(throwError(() => axiosErrorWithStatus(500)));

    await expect(createService('key').fetchGenres()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(httpService.get).toHaveBeenCalledTimes(3);
  });

  it('does not retry client errors such as an invalid API key', async () => {
    httpService.get.mockReturnValue(throwError(() => axiosErrorWithStatus(401)));

    await expect(createService('bad-key').fetchGenres()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });

  it('retries rate-limit responses', async () => {
    const payload = { genres: [] };
    httpService.get
      .mockReturnValueOnce(throwError(() => axiosErrorWithStatus(429)))
      .mockReturnValueOnce(asResponse(payload));

    await expect(createService('key').fetchGenres()).resolves.toEqual([]);
    expect(httpService.get).toHaveBeenCalledTimes(2);
  });
});

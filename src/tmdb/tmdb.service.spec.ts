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
    return new TmdbService(httpService as unknown as HttpService, configService);
  };

  const asResponse = <T>(data: T) => of({ data } as AxiosResponse<T>);

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

  it('translates HTTP failures into a ServiceUnavailableException', async () => {
    httpService.get.mockReturnValue(throwError(() => new AxiosError('Request failed', '500')));

    await expect(createService('key').fetchGenres()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('handles non-axios errors the same way', async () => {
    httpService.get.mockReturnValue(throwError(() => new Error('socket hang up')));

    await expect(createService('key').fetchPopularMovies(1)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

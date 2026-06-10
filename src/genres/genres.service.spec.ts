import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AppCacheService } from '../cache/app-cache.service';
import { Genre } from './entities/genre.entity';
import { GenresService } from './genres.service';

describe('GenresService', () => {
  it('returns genres ordered by name, through the cache', async () => {
    const genres = [{ id: 28, name: 'Action' }];
    const genresRepository = {
      find: jest.fn().mockResolvedValue(genres),
    } as unknown as Repository<Genre>;
    const cacheService = {
      getOrSet: jest.fn((_key, _ttl, factory) => factory()),
    } as unknown as AppCacheService;
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(60_000),
    } as unknown as ConfigService;

    const service = new GenresService(genresRepository, cacheService, configService);

    await expect(service.findAll()).resolves.toEqual(genres);
    expect(cacheService.getOrSet).toHaveBeenCalledWith('genres:all', 60_000, expect.any(Function));
    expect(genresRepository.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
  });
});

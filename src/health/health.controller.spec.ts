import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppCacheService } from '../cache/app-cache.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let dataSource: { query: jest.Mock };
  let cacheService: { ping: jest.Mock };
  let controller: HealthController;

  beforeEach(() => {
    dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    cacheService = { ping: jest.fn().mockResolvedValue(true) };
    controller = new HealthController(
      dataSource as unknown as DataSource,
      cacheService as unknown as AppCacheService,
    );
  });

  it('reports ok when the database and cache respond', async () => {
    const result = await controller.check();

    expect(result).toMatchObject({ status: 'ok', database: 'up', cache: 'up' });
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns 503 when the database is unreachable', async () => {
    dataSource.query.mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toThrow('Database is unreachable');
  });

  it('returns 503 when the cache round-trip fails', async () => {
    cacheService.ping.mockResolvedValue(false);

    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns 503 when the cache ping throws', async () => {
    cacheService.ping.mockRejectedValue(new Error('redis down'));

    await expect(controller.check()).rejects.toThrow('Cache is unreachable');
  });
});

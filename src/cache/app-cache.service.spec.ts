import { Cache } from 'cache-manager';
import { AppCacheService } from './app-cache.service';

describe('AppCacheService', () => {
  let cacheManager: jest.Mocked<Pick<Cache, 'get' | 'set' | 'del'>>;
  let service: AppCacheService;

  beforeEach(() => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    service = new AppCacheService(cacheManager as unknown as Cache);
  });

  describe('getOrSet', () => {
    it('returns the cached value without calling the factory', async () => {
      cacheManager.get.mockResolvedValue('cached-value');
      const factory = jest.fn();

      const result = await service.getOrSet('key', 1000, factory);

      expect(result).toBe('cached-value');
      expect(factory).not.toHaveBeenCalled();
    });

    it('computes, stores and returns the value on a cache miss', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      const factory = jest.fn().mockResolvedValue('fresh-value');

      const result = await service.getOrSet('key', 1000, factory);

      expect(result).toBe('fresh-value');
      expect(cacheManager.set).toHaveBeenCalledWith('key', 'fresh-value', 1000);
    });

    it('does not cache anything when the factory throws', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      const factory = jest.fn().mockRejectedValue(new Error('boom'));

      await expect(service.getOrSet('key', 1000, factory)).rejects.toThrow('boom');
      expect(cacheManager.set).not.toHaveBeenCalled();
    });
  });

  it('deletes keys', async () => {
    await service.del('key');
    expect(cacheManager.del).toHaveBeenCalledWith('key');
  });

  describe('ping', () => {
    it('round-trips a value through the store', async () => {
      cacheManager.get.mockResolvedValue('ok');

      await expect(service.ping()).resolves.toBe(true);
      expect(cacheManager.set).toHaveBeenCalledWith('health:ping', 'ok', 5_000);
    });

    it('reports an unhealthy store', async () => {
      cacheManager.get.mockResolvedValue(undefined);

      await expect(service.ping()).resolves.toBe(false);
    });
  });

  describe('namespace versions', () => {
    it('defaults to version 1 when none is stored', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      await expect(service.getNamespaceVersion('movies')).resolves.toBe(1);
    });

    it('returns the stored version', async () => {
      cacheManager.get.mockResolvedValue(7);
      await expect(service.getNamespaceVersion('movies')).resolves.toBe(7);
    });

    it('bumps the version with no expiry', async () => {
      cacheManager.get.mockResolvedValue(3);

      await service.bumpNamespaceVersion('movies');

      expect(cacheManager.set).toHaveBeenCalledWith('movies:version', 4, 0);
    });
  });
});

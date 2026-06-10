import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

describe('SyncController', () => {
  it('delegates to the sync service', async () => {
    const syncService = {
      syncAll: jest.fn().mockResolvedValue({ genres: 19, movies: 100 }),
    } as unknown as SyncService;
    const controller = new SyncController(syncService);

    await expect(controller.sync()).resolves.toEqual({ genres: 19, movies: 100 });
    expect(syncService.syncAll).toHaveBeenCalled();
  });
});

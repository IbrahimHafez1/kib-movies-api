import { SyncStatus, SyncService } from './sync.service';
import { SyncController } from './sync.controller';

const runningStatus: SyncStatus = {
  state: 'running',
  startedAt: '2026-06-15T03:00:00.000Z',
  finishedAt: null,
  lastResult: null,
  lastError: null,
};

const idleStatus: SyncStatus = {
  state: 'idle',
  startedAt: '2026-06-15T03:00:00.000Z',
  finishedAt: '2026-06-15T03:00:04.000Z',
  lastResult: { genres: 19, movies: 100 },
  lastError: null,
};

describe('SyncController', () => {
  it('starts a background sync and returns the running status', () => {
    const syncService = {
      requestSync: jest.fn().mockReturnValue(runningStatus),
    } as unknown as SyncService;
    const controller = new SyncController(syncService);

    expect(controller.sync()).toEqual(runningStatus);
    expect(syncService.requestSync).toHaveBeenCalled();
  });

  it('reports the current sync status', () => {
    const syncService = {
      getSyncStatus: jest.fn().mockReturnValue(idleStatus),
    } as unknown as SyncService;
    const controller = new SyncController(syncService);

    expect(controller.status()).toEqual(idleStatus);
    expect(syncService.getSyncStatus).toHaveBeenCalled();
  });
});

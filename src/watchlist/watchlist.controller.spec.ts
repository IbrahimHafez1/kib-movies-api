import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';

describe('WatchlistController', () => {
  const user = { userId: 'user-1', email: 'jane@example.com' };
  const watchlistService = {
    list: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
  };
  const controller = new WatchlistController(watchlistService as unknown as WatchlistService);

  it('lists the watchlist for the authenticated user', async () => {
    const page = { data: [], meta: {} };
    watchlistService.list.mockResolvedValue(page);
    const query = new PaginationQueryDto();

    await expect(controller.list(user, query)).resolves.toBe(page);
    expect(watchlistService.list).toHaveBeenCalledWith('user-1', query);
  });

  it('adds a movie to the watchlist', async () => {
    const item = { movieId: 603 };
    watchlistService.add.mockResolvedValue(item);

    await expect(controller.add(user, 603)).resolves.toBe(item);
    expect(watchlistService.add).toHaveBeenCalledWith('user-1', 603);
  });

  it('removes a movie from the watchlist', async () => {
    await controller.remove(user, 603);

    expect(watchlistService.remove).toHaveBeenCalledWith('user-1', 603);
  });
});

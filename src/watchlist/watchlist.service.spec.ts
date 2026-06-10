import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Movie } from '../movies/entities/movie.entity';
import { MoviesService } from '../movies/movies.service';
import { WatchlistItem } from './entities/watchlist-item.entity';
import { WatchlistService } from './watchlist.service';

const movie = { id: 603, title: 'The Matrix', genres: [] } as unknown as Movie;

describe('WatchlistService', () => {
  let watchlistRepository: {
    findOne: jest.Mock;
    findAndCount: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let moviesRepository: { findOne: jest.Mock };
  let moviesService: { getRatingStats: jest.Mock };
  let service: WatchlistService;

  beforeEach(() => {
    watchlistRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn((item) => item),
      save: jest.fn((item) => ({ createdAt: new Date(), ...item })),
      delete: jest.fn(),
    };
    moviesRepository = { findOne: jest.fn().mockResolvedValue(movie) };
    moviesService = {
      getRatingStats: jest.fn().mockResolvedValue(new Map([[603, { average: 8, count: 2 }]])),
    };
    service = new WatchlistService(
      watchlistRepository as unknown as Repository<WatchlistItem>,
      moviesRepository as unknown as Repository<Movie>,
      moviesService as unknown as MoviesService,
    );
  });

  describe('add', () => {
    it('adds a movie with its rating stats', async () => {
      watchlistRepository.findOne.mockResolvedValue(null);

      const result = await service.add('user-1', 603);

      expect(result.movie).toMatchObject({ id: 603, averageRating: 8, ratingCount: 2 });
      expect(watchlistRepository.save).toHaveBeenCalled();
    });

    it('rejects movies that do not exist', async () => {
      moviesRepository.findOne.mockResolvedValue(null);

      await expect(service.add('user-1', 999)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects duplicates with a ConflictException', async () => {
      watchlistRepository.findOne.mockResolvedValue({ id: 'item-1' });

      await expect(service.add('user-1', 603)).rejects.toBeInstanceOf(ConflictException);
      expect(watchlistRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('removes an existing watchlist entry', async () => {
      watchlistRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove('user-1', 603);

      expect(watchlistRepository.delete).toHaveBeenCalledWith({ userId: 'user-1', movieId: 603 });
    });

    it('throws when the movie is not on the watchlist', async () => {
      watchlistRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove('user-1', 603)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    it('returns the paginated watchlist with rating stats', async () => {
      watchlistRepository.findAndCount.mockResolvedValue([
        [{ movieId: 603, createdAt: new Date(), movie }],
        1,
      ]);

      const result = await service.list('user-1', new PaginationQueryDto());

      expect(result.meta.totalItems).toBe(1);
      expect(result.data[0].movie).toMatchObject({ id: 603, averageRating: 8 });
      expect(watchlistRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 20,
        }),
      );
    });
  });
});

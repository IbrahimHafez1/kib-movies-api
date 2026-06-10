import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Movie } from '../movies/entities/movie.entity';
import { MoviesService } from '../movies/movies.service';
import { Rating } from './entities/rating.entity';
import { RatingsService } from './ratings.service';

describe('RatingsService', () => {
  let ratingsRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let moviesRepository: { exists: jest.Mock };
  let moviesService: { invalidateMovieCaches: jest.Mock };
  let service: RatingsService;

  beforeEach(() => {
    ratingsRepository = {
      findOne: jest.fn(),
      create: jest.fn((rating) => rating),
      save: jest.fn((rating) => ({ updatedAt: new Date(), ...rating })),
      delete: jest.fn(),
    };
    moviesRepository = { exists: jest.fn().mockResolvedValue(true) };
    moviesService = { invalidateMovieCaches: jest.fn() };
    service = new RatingsService(
      ratingsRepository as unknown as Repository<Rating>,
      moviesRepository as unknown as Repository<Movie>,
      moviesService as unknown as MoviesService,
    );
  });

  describe('rateMovie', () => {
    it('creates a rating when the user has none for the movie', async () => {
      ratingsRepository.findOne.mockResolvedValue(null);

      const result = await service.rateMovie('user-1', 603, { value: 9 });

      expect(result).toMatchObject({ movieId: 603, value: 9 });
      expect(ratingsRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        movieId: 603,
        value: 9,
      });
      expect(moviesService.invalidateMovieCaches).toHaveBeenCalledWith(603);
    });

    it('updates the existing rating on re-rate', async () => {
      ratingsRepository.findOne.mockResolvedValue({
        id: 'rating-1',
        userId: 'user-1',
        movieId: 603,
        value: 9,
      });

      const result = await service.rateMovie('user-1', 603, { value: 4 });

      expect(result.value).toBe(4);
      expect(ratingsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rating-1', value: 4 }),
      );
      expect(ratingsRepository.create).not.toHaveBeenCalled();
    });

    it('rejects ratings for movies that do not exist', async () => {
      moviesRepository.exists.mockResolvedValue(false);

      await expect(service.rateMovie('user-1', 999, { value: 5 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(ratingsRepository.save).not.toHaveBeenCalled();
      expect(moviesService.invalidateMovieCaches).not.toHaveBeenCalled();
    });
  });

  describe('deleteRating', () => {
    it('deletes the rating and invalidates caches', async () => {
      ratingsRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deleteRating('user-1', 603);

      expect(ratingsRepository.delete).toHaveBeenCalledWith({ userId: 'user-1', movieId: 603 });
      expect(moviesService.invalidateMovieCaches).toHaveBeenCalledWith(603);
    });

    it('throws when there is nothing to delete', async () => {
      ratingsRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.deleteRating('user-1', 603)).rejects.toBeInstanceOf(NotFoundException);
      expect(moviesService.invalidateMovieCaches).not.toHaveBeenCalled();
    });
  });
});

import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

describe('RatingsController', () => {
  const user = { userId: 'user-1', email: 'jane@example.com' };
  const ratingsService = {
    rateMovie: jest.fn(),
    deleteRating: jest.fn(),
  };
  const controller = new RatingsController(ratingsService as unknown as RatingsService);

  it('rates a movie on behalf of the authenticated user', async () => {
    const rating = { movieId: 603, value: 9 };
    ratingsService.rateMovie.mockResolvedValue(rating);

    await expect(controller.rateMovie(user, 603, { value: 9 })).resolves.toBe(rating);
    expect(ratingsService.rateMovie).toHaveBeenCalledWith('user-1', 603, { value: 9 });
  });

  it("removes the user's rating", async () => {
    await controller.deleteRating(user, 603);

    expect(ratingsService.deleteRating).toHaveBeenCalledWith('user-1', 603);
  });
});

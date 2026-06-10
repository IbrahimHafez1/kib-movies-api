import { GenresController } from './genres.controller';
import { GenresService } from './genres.service';

describe('GenresController', () => {
  it('returns all genres', async () => {
    const genres = [{ id: 28, name: 'Action' }];
    const genresService = {
      findAll: jest.fn().mockResolvedValue(genres),
    } as unknown as GenresService;
    const controller = new GenresController(genresService);

    await expect(controller.findAll()).resolves.toEqual(genres);
  });
});

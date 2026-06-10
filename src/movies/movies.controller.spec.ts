import { ListMoviesQueryDto } from './dto/list-movies-query.dto';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';

describe('MoviesController', () => {
  const moviesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
  };
  const controller = new MoviesController(moviesService as unknown as MoviesService);

  it('lists movies with the given query', async () => {
    const response = { data: [], meta: { page: 1 } };
    moviesService.findAll.mockResolvedValue(response);
    const query = new ListMoviesQueryDto();

    await expect(controller.findAll(query)).resolves.toBe(response);
    expect(moviesService.findAll).toHaveBeenCalledWith(query);
  });

  it('returns a single movie', async () => {
    const movie = { id: 603, title: 'The Matrix' };
    moviesService.findOne.mockResolvedValue(movie);

    await expect(controller.findOne(603)).resolves.toBe(movie);
    expect(moviesService.findOne).toHaveBeenCalledWith(603);
  });
});

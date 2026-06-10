import { ConflictException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let usersRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let service: UsersService;

  beforeEach(() => {
    usersRepository = {
      findOne: jest.fn(),
      create: jest.fn((user) => user),
      save: jest.fn((user) => ({ id: 'user-1', ...user })),
      update: jest.fn(),
    };
    service = new UsersService(usersRepository as unknown as Repository<User>);
  });

  describe('create', () => {
    it('persists a new user', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const user = await service.create('jane@example.com', 'hash');

      expect(user).toMatchObject({ email: 'jane@example.com', passwordHash: 'hash' });
      expect(usersRepository.save).toHaveBeenCalled();
    });

    it('rejects duplicate emails with a ConflictException', async () => {
      usersRepository.findOne.mockResolvedValue({ id: 'existing' });

      await expect(service.create('jane@example.com', 'hash')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it('reports a conflict when a concurrent registration wins the race', async () => {
      usersRepository.findOne.mockResolvedValue(null);
      usersRepository.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], { code: '23505' } as never),
      );

      await expect(service.create('jane@example.com', 'hash')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rethrows unexpected database errors', async () => {
      usersRepository.findOne.mockResolvedValue(null);
      usersRepository.save.mockRejectedValue(new Error('connection reset'));

      await expect(service.create('jane@example.com', 'hash')).rejects.toThrow('connection reset');
    });
  });

  it('finds users by email and id', async () => {
    usersRepository.findOne.mockResolvedValue({ id: 'user-1' });

    await expect(service.findByEmail('jane@example.com')).resolves.toEqual({ id: 'user-1' });
    await expect(service.findById('user-1')).resolves.toEqual({ id: 'user-1' });
  });

  it('updates the stored refresh token hash', async () => {
    await service.setRefreshTokenHash('user-1', 'digest');

    expect(usersRepository.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      { refreshTokenHash: 'digest' },
    );
  });
});

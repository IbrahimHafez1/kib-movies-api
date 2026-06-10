import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppCacheService } from '../cache/app-cache.service';
import { Genre } from './entities/genre.entity';

export const GENRES_CACHE_KEY = 'genres:all';

@Injectable()
export class GenresService {
  private readonly cacheTtlMs: number;

  constructor(
    @InjectRepository(Genre) private readonly genresRepository: Repository<Genre>,
    private readonly cacheService: AppCacheService,
    configService: ConfigService,
  ) {
    this.cacheTtlMs = configService.getOrThrow<number>('cache.ttlMs');
  }

  async findAll(): Promise<Genre[]> {
    return this.cacheService.getOrSet(GENRES_CACHE_KEY, this.cacheTtlMs, () =>
      this.genresRepository.find({ order: { name: 'ASC' } }),
    );
  }
}

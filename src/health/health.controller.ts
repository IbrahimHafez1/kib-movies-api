import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppCacheService } from '../cache/app-cache.service';

export interface HealthStatus {
  status: 'ok';
  database: 'up';
  cache: 'up';
  uptimeSeconds: number;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cacheService: AppCacheService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness check covering the database and cache' })
  @ApiOkResponse({ description: 'Service, database and cache are healthy' })
  @ApiServiceUnavailableResponse({ description: 'A dependency is unreachable' })
  async check(): Promise<HealthStatus> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Database is unreachable');
    }

    let cacheHealthy: boolean;
    try {
      cacheHealthy = await this.cacheService.ping();
    } catch {
      cacheHealthy = false;
    }
    if (!cacheHealthy) {
      throw new ServiceUnavailableException('Cache is unreachable');
    }

    return {
      status: 'ok',
      database: 'up',
      cache: 'up',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}

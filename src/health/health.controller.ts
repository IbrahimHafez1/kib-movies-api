import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppCacheService } from '../cache/app-cache.service';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok';

  @ApiProperty({ example: 'up', description: 'PostgreSQL connectivity' })
  database: 'up';

  @ApiProperty({ example: 'up', description: 'Redis connectivity' })
  cache: 'up';

  @ApiProperty({ example: 1234 })
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
  @ApiOkResponse({
    type: HealthResponseDto,
    description: 'Service, database and cache are healthy',
  })
  @ApiServiceUnavailableResponse({ description: 'A dependency is unreachable' })
  async check(): Promise<HealthResponseDto> {
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

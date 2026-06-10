import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface HealthStatus {
  status: 'ok';
  database: 'up';
  uptimeSeconds: number;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Liveness and database connectivity check' })
  @ApiOkResponse({ description: 'Service and database are healthy' })
  @ApiServiceUnavailableResponse({ description: 'Database is unreachable' })
  async check(): Promise<HealthStatus> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Database is unreachable');
    }
    return {
      status: 'ok',
      database: 'up',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}

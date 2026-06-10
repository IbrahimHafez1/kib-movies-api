import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports ok when the database responds', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(dataSource as unknown as DataSource);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('returns 503 when the database is unreachable', async () => {
    const dataSource = { query: jest.fn().mockRejectedValue(new Error('connection refused')) };
    const controller = new HealthController(dataSource as unknown as DataSource);

    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

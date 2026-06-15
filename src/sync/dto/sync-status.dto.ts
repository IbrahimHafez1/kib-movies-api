import { ApiProperty } from '@nestjs/swagger';
import { SyncResultDto } from './sync-result.dto';

/** Progress of the on-demand sync; documents the response shape in Swagger. */
export class SyncStatusDto {
  @ApiProperty({
    enum: ['idle', 'running'],
    description: 'Whether a sync is currently in progress',
    example: 'running',
  })
  state: 'idle' | 'running';

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'When the current or most recent run started (ISO 8601)',
    example: '2026-06-15T03:00:00.000Z',
  })
  startedAt: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'When the most recent run finished, or null while running',
    example: '2026-06-15T03:00:04.000Z',
  })
  finishedAt: string | null;

  @ApiProperty({
    nullable: true,
    type: SyncResultDto,
    description: 'Counts from the most recent successful run',
  })
  lastResult: SyncResultDto | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Error message from the most recent failed run, if any',
    example: null,
  })
  lastError: string | null;
}

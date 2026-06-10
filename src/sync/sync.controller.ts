import { Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SyncResult, SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Trigger a TMDB sync on demand',
    description:
      'Upserts genres and popular movies from TMDB. Idempotent: running it repeatedly ' +
      'converges instead of duplicating. Returns zero counts when no TMDB key is configured.',
  })
  @ApiCreatedResponse({ description: 'Number of genres and movies synced' })
  @ApiUnauthorizedResponse({ description: 'Missing or expired credentials' })
  sync(): Promise<SyncResult> {
    return this.syncService.syncAll();
  }
}

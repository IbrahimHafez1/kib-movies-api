import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SyncResultDto } from './dto/sync-result.dto';
import { SyncResult, SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  // Open to any authenticated user by design: the sync is idempotent and globally
  // rate-limited, so the blast radius is a few TMDB calls. Admin-only RBAC is the
  // documented next step rather than speculative scope.
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Trigger a TMDB sync on demand',
    description:
      'Upserts genres and popular movies from TMDB. Idempotent: running it repeatedly ' +
      'converges instead of duplicating. Returns zero counts when no TMDB key is configured.',
  })
  @ApiOkResponse({ type: SyncResultDto, description: 'Number of genres and movies synced' })
  @ApiUnauthorizedResponse({ description: 'Missing or expired credentials' })
  sync(): Promise<SyncResult> {
    return this.syncService.syncAll();
  }
}

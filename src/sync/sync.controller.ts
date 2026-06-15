import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SyncStatusDto } from './dto/sync-status.dto';
import { SyncStatus, SyncService } from './sync.service';

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
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Trigger a TMDB sync on demand',
    description:
      'Starts a background sync of genres and popular movies from TMDB and returns 202 ' +
      'immediately. Idempotent: running it repeatedly converges instead of duplicating. ' +
      'A request received while a sync is already running is a no-op. Poll GET /sync/status ' +
      'for progress and the resulting counts.',
  })
  @ApiAcceptedResponse({ type: SyncStatusDto, description: 'Sync accepted; current status' })
  @ApiUnauthorizedResponse({ description: 'Missing or expired credentials' })
  sync(): SyncStatus {
    return this.syncService.requestSync();
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Report the status of the on-demand sync',
    description: 'Returns whether a sync is running plus the counts from the most recent run.',
  })
  @ApiOkResponse({ type: SyncStatusDto, description: 'Current sync status' })
  @ApiUnauthorizedResponse({ description: 'Missing or expired credentials' })
  status(): SyncStatus {
    return this.syncService.getSyncStatus();
  }
}

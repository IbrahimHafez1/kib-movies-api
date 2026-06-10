import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('root')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Service information' })
  getInfo(): { name: string; docs: string; health: string } {
    return {
      name: 'Movies API',
      docs: '/docs',
      health: '/health',
    };
  }
}

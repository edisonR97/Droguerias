import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './auth/public.decorator';
import { PrismaService } from './prisma/prisma.service';
import { checkHealth } from './health';
import { AllowUnlicensed } from './licensing/allow-unlicensed.decorator';

@ApiTags('system')
@AllowUnlicensed()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    return checkHealth(this.prisma);
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PermissionCode, type DashboardSummary } from '@farmacore/shared';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get('summary')
  @RequirePermissions(PermissionCode.DASHBOARD_READ)
  summary(@CurrentUser() user: RequestUser): Promise<DashboardSummary> {
    return this.dashboard.summary(user.establishmentId);
  }
}

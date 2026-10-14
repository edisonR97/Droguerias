import { Controller, Get, Query, Res } from '@nestjs/common';
import { PermissionCode } from '@farmacore/shared';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ReportQueryDto } from './reports.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @RequirePermissions(PermissionCode.REPORTS_EXPORT)
  summary(@CurrentUser() user: RequestUser, @Query() query: ReportQueryDto) {
    return this.reports.summary(user, query);
  }

  @Get('sales.csv')
  @RequirePermissions(PermissionCode.REPORTS_EXPORT)
  async salesCsv(
    @CurrentUser() user: RequestUser,
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.type('text/csv; charset=utf-8');
    response.attachment('ventas-farmacore.csv');
    return this.reports.salesCsv(user, query);
  }
}

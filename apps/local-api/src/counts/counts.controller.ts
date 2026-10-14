import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { PermissionCode } from '@farmacore/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateCountDto } from './counts.dto';
import { CountsService } from './counts.service';
@Controller('inventory-counts')
export class CountsController {
  constructor(private readonly s: CountsService) {}
  @Get() @RequirePermissions(PermissionCode.COUNTS_READ) list(@CurrentUser() u: RequestUser) {
    return this.s.list(u);
  }
  @Post() @RequirePermissions(PermissionCode.COUNTS_CREATE) create(
    @CurrentUser() u: RequestUser,
    @Body() i: CreateCountDto,
  ) {
    return this.s.create(u, i);
  }
  @Post(':id/approve') @RequirePermissions(PermissionCode.COUNTS_APPROVE) approve(
    @CurrentUser() u: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.approve(u, id);
  }
  @Post(':id/apply') @RequirePermissions(PermissionCode.COUNTS_APPROVE) apply(
    @CurrentUser() u: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.apply(u, id);
  }
}

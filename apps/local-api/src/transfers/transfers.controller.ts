import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { PermissionCode } from '@farmacore/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateTransferDto } from './transfers.dto';
import { TransfersService } from './transfers.service';
@Controller('transfers')
export class TransfersController {
  constructor(private readonly service: TransfersService) {}
  @Get('context') @RequirePermissions(PermissionCode.TRANSFERS_READ) context(
    @CurrentUser() u: RequestUser,
  ) {
    return this.service.context(u);
  }
  @Get() @RequirePermissions(PermissionCode.TRANSFERS_READ) list(@CurrentUser() u: RequestUser) {
    return this.service.list(u);
  }
  @Post() @RequirePermissions(PermissionCode.TRANSFERS_MANAGE) create(
    @CurrentUser() u: RequestUser,
    @Body() i: CreateTransferDto,
  ) {
    return this.service.create(u, i);
  }
  @Post(':id/ship') @RequirePermissions(PermissionCode.TRANSFERS_MANAGE) ship(
    @CurrentUser() u: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.ship(u, id);
  }
  @Post(':id/receive') @RequirePermissions(PermissionCode.TRANSFERS_MANAGE) receive(
    @CurrentUser() u: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.receive(u, id);
  }
  @Post(':id/cancel') @RequirePermissions(PermissionCode.TRANSFERS_MANAGE) cancel(
    @CurrentUser() u: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.cancel(u, id);
  }
}

import { Body, Controller, Get, Post } from '@nestjs/common';
import { PermissionCode } from '@farmacore/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateReturnDto } from './returns.dto';
import { ReturnsService } from './returns.service';
@Controller('returns')
export class ReturnsController {
  constructor(private readonly s: ReturnsService) {}
  @Get() @RequirePermissions(PermissionCode.POS_SELL) list(@CurrentUser() u: RequestUser) {
    return this.s.list(u);
  }
  @Post() @RequirePermissions(PermissionCode.RETURNS_CREATE) create(
    @CurrentUser() u: RequestUser,
    @Body() i: CreateReturnDto,
  ) {
    return this.s.create(u, i);
  }
}

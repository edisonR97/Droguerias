import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PermissionCode } from '@farmacore/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CheckoutDto, CloseCashSessionDto, OpenCashSessionDto, VoidSaleDto } from './pos.dto';
import { PosService } from './pos.service';

@ApiTags('pos')
@ApiBearerAuth()
@Controller('pos')
export class PosController {
  constructor(private readonly pos: PosService) {}
  @Post('cash-sessions') @RequirePermissions(PermissionCode.CASH_MANAGE) open(
    @CurrentUser() user: RequestUser,
    @Body() input: OpenCashSessionDto,
  ) {
    return this.pos.openCash(user, input);
  }
  @Get('cash-sessions/open') @RequirePermissions(PermissionCode.POS_SELL) current(
    @CurrentUser() user: RequestUser,
    @Query('branchId') branchId: string,
  ) {
    return this.pos.getOpenCash(user, branchId);
  }
  @Get('context') @RequirePermissions(PermissionCode.POS_SELL) context(
    @CurrentUser() user: RequestUser,
  ) {
    return this.pos.context(user);
  }
  @Post('cash-sessions/:id/close') @RequirePermissions(PermissionCode.CASH_MANAGE) close(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CloseCashSessionDto,
  ) {
    return this.pos.closeCash(user, id, input);
  }
  @Get('sales') @RequirePermissions(PermissionCode.POS_SELL) sales(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
  ) {
    return this.pos.salesHistory(user, search);
  }
  @Get('cash-sessions') @RequirePermissions(PermissionCode.CASH_MANAGE) cashHistory(
    @CurrentUser() user: RequestUser,
  ) {
    return this.pos.cashHistory(user);
  }
  @Get('sales/:id') @RequirePermissions(PermissionCode.POS_SELL) receipt(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pos.receipt(user, id);
  }
  @Post('sales/:id/void') @RequirePermissions(PermissionCode.SALES_VOID) voidSale(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: VoidSaleDto,
  ) {
    return this.pos.voidSale(user, id, input);
  }
  @Post('checkout') @RequirePermissions(PermissionCode.POS_SELL) checkout(
    @CurrentUser() user: RequestUser,
    @Body() input: CheckoutDto,
  ) {
    return this.pos.checkout(user, input);
  }
}

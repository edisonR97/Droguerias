import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PermissionCode } from '@farmacore/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreatePurchaseOrderDto, CreateSupplierDto, ReceivePurchaseDto } from './purchases.dto';
import { PurchasesService } from './purchases.service';
@ApiTags('purchases')
@ApiBearerAuth()
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}
  @Get('context') @RequirePermissions(PermissionCode.PURCHASES_READ) context(
    @CurrentUser() u: RequestUser,
  ) {
    return this.purchases.context(u);
  }
  @Get() @RequirePermissions(PermissionCode.PURCHASES_READ) list(@CurrentUser() u: RequestUser) {
    return this.purchases.list(u);
  }
  @Post('suppliers') @RequirePermissions(PermissionCode.PURCHASES_MANAGE) supplier(
    @CurrentUser() u: RequestUser,
    @Body() i: CreateSupplierDto,
  ) {
    return this.purchases.createSupplier(u, i);
  }
  @Post() @RequirePermissions(PermissionCode.PURCHASES_MANAGE) create(
    @CurrentUser() u: RequestUser,
    @Body() i: CreatePurchaseOrderDto,
  ) {
    return this.purchases.create(u, i);
  }
  @Post(':id/approve') @RequirePermissions(PermissionCode.PURCHASES_APPROVE) approve(
    @CurrentUser() u: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.purchases.approve(u, id);
  }
  @Post(':id/receive') @RequirePermissions(PermissionCode.PURCHASES_MANAGE) receive(
    @CurrentUser() u: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() i: ReceivePurchaseDto,
  ) {
    return this.purchases.receive(u, id, i);
  }
}

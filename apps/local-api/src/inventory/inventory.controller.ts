import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PermissionCode } from '@farmacore/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/permissions.decorator';
import { FefoQueryDto, InventoryQueryDto, ReceiveInventoryDto } from './inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Post('receipts') @RequirePermissions(PermissionCode.INVENTORY_RECEIVE) receive(
    @CurrentUser() user: RequestUser,
    @Body() input: ReceiveInventoryDto,
  ) {
    return this.inventory.receive(user, input);
  }
  @Get('fefo') @RequirePermissions(PermissionCode.INVENTORY_READ) fefo(
    @CurrentUser() user: RequestUser,
    @Query() query: FefoQueryDto,
  ) {
    return this.inventory.fefo(user, query);
  }
  @Get('kardex') @RequirePermissions(PermissionCode.INVENTORY_READ) kardex(
    @CurrentUser() user: RequestUser,
    @Query() query: InventoryQueryDto,
  ) {
    return this.inventory.kardex(user, query);
  }
  @Get('expiry-alerts') @RequirePermissions(PermissionCode.INVENTORY_READ) expiry(
    @CurrentUser() user: RequestUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.inventory.expirySummary(user, branchId);
  }
}

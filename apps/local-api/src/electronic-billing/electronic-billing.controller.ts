import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { PermissionCode } from '@farmacore/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ElectronicBillingService } from './electronic-billing.service';

@Controller('electronic-billing')
export class ElectronicBillingController {
  constructor(private readonly billing: ElectronicBillingService) {}

  @Get('documents')
  @RequirePermissions(PermissionCode.ELECTRONIC_BILLING_MANAGE)
  list(@CurrentUser() user: RequestUser) {
    return this.billing.list(user.establishmentId);
  }

  @Post('sales/:saleId/submit')
  @RequirePermissions(PermissionCode.ELECTRONIC_BILLING_MANAGE)
  submit(@CurrentUser() user: RequestUser, @Param('saleId', ParseUUIDPipe) saleId: string) {
    return this.billing.submitSale(user, saleId);
  }
}

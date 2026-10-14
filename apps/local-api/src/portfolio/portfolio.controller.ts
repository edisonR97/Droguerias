import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { PermissionCode } from '@farmacore/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RegisterPortfolioPaymentDto } from './portfolio.dto';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}
  @Get('summary')
  @RequirePermissions(PermissionCode.PORTFOLIO_READ)
  summary(@CurrentUser() user: RequestUser) {
    return this.portfolio.summary(user);
  }
  @Get('receivables')
  @RequirePermissions(PermissionCode.PORTFOLIO_READ)
  receivables(@CurrentUser() user: RequestUser) {
    return this.portfolio.receivables(user);
  }
  @Get('payables')
  @RequirePermissions(PermissionCode.PORTFOLIO_READ)
  payables(@CurrentUser() user: RequestUser) {
    return this.portfolio.payables(user);
  }
  @Post('receivables/:id/payments')
  @RequirePermissions(PermissionCode.PORTFOLIO_MANAGE)
  payReceivable(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RegisterPortfolioPaymentDto,
  ) {
    return this.portfolio.payReceivable(user, id, input);
  }
  @Post('payables/:id/payments')
  @RequirePermissions(PermissionCode.PORTFOLIO_MANAGE)
  payPayable(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RegisterPortfolioPaymentDto,
  ) {
    return this.portfolio.payPayable(user, id, input);
  }
}

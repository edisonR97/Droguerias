import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { PermissionCode } from '@farmacore/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/permissions.decorator';
import {
  CreateAccountDto,
  CreateJournalEntryDto,
  ReverseEntryDto,
  TrialBalanceQueryDto,
} from './accounting.dto';
import { AccountingService } from './accounting.service';

@Controller('accounting')
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}
  @Get('accounts')
  @RequirePermissions(PermissionCode.ACCOUNTING_READ)
  accounts(@CurrentUser() user: RequestUser) {
    return this.accounting.accounts(user);
  }
  @Post('accounts')
  @RequirePermissions(PermissionCode.ACCOUNTING_MANAGE)
  createAccount(@CurrentUser() user: RequestUser, @Body() input: CreateAccountDto) {
    return this.accounting.createAccount(user, input);
  }
  @Get('entries')
  @RequirePermissions(PermissionCode.ACCOUNTING_READ)
  entries(@CurrentUser() user: RequestUser) {
    return this.accounting.entries(user);
  }
  @Post('entries')
  @RequirePermissions(PermissionCode.ACCOUNTING_MANAGE)
  createEntry(@CurrentUser() user: RequestUser, @Body() input: CreateJournalEntryDto) {
    return this.accounting.createEntry(user, input);
  }
  @Post('entries/:id/reverse')
  @RequirePermissions(PermissionCode.ACCOUNTING_MANAGE)
  reverse(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReverseEntryDto,
  ) {
    return this.accounting.reverse(user, id, input);
  }
  @Get('trial-balance')
  @RequirePermissions(PermissionCode.ACCOUNTING_READ)
  trialBalance(@CurrentUser() user: RequestUser, @Query() query: TrialBalanceQueryDto) {
    return this.accounting.trialBalance(user, query);
  }
}

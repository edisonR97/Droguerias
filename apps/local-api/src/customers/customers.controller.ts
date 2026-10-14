import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PermissionCode } from '@farmacore/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateCustomerDto } from './customer.dto';
import { CustomersService } from './customers.service';
@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}
  @Get() @RequirePermissions(PermissionCode.POS_SELL) list(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
  ) {
    return this.customers.list(user, search);
  }
  @Post() @RequirePermissions(PermissionCode.CUSTOMERS_MANAGE) create(
    @CurrentUser() user: RequestUser,
    @Body() input: CreateCustomerDto,
  ) {
    return this.customers.create(user, input);
  }
}

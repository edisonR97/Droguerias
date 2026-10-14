import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { PermissionCode } from '@farmacore/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/permissions.decorator';
import {
  CreateBranchDto,
  CreateUserDto,
  ResetPasswordDto,
  UpdateBranchDto,
  UpdateEstablishmentDto,
  UpdateUserDto,
} from './admin.dto';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('context')
  @RequirePermissions(PermissionCode.USERS_MANAGE)
  context(@CurrentUser() user: RequestUser) {
    return this.admin.context(user);
  }

  @Post('users')
  @RequirePermissions(PermissionCode.USERS_MANAGE)
  createUser(@CurrentUser() user: RequestUser, @Body() input: CreateUserDto) {
    return this.admin.createUser(user, input);
  }

  @Patch('users/:id')
  @RequirePermissions(PermissionCode.USERS_MANAGE)
  updateUser(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateUserDto,
  ) {
    return this.admin.updateUser(user, id, input);
  }

  @Post('users/:id/reset-password')
  @RequirePermissions(PermissionCode.USERS_MANAGE)
  resetPassword(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ResetPasswordDto,
  ) {
    return this.admin.resetPassword(user, id, input);
  }

  @Post('branches')
  @RequirePermissions(PermissionCode.SYSTEM_CONFIGURE)
  createBranch(@CurrentUser() user: RequestUser, @Body() input: CreateBranchDto) {
    return this.admin.createBranch(user, input);
  }

  @Patch('branches/:id')
  @RequirePermissions(PermissionCode.SYSTEM_CONFIGURE)
  updateBranch(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateBranchDto,
  ) {
    return this.admin.updateBranch(user, id, input);
  }

  @Patch('establishment')
  @RequirePermissions(PermissionCode.SYSTEM_CONFIGURE)
  updateEstablishment(@CurrentUser() user: RequestUser, @Body() input: UpdateEstablishmentDto) {
    return this.admin.updateEstablishment(user, input);
  }
}

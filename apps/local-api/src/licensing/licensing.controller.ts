import { Body, Controller, Get, Post } from '@nestjs/common';
import { PermissionCode } from '@farmacore/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ActivateLicenseDto } from './licensing.dto';
import { LicensingService } from './licensing.service';
import { AllowUnlicensed } from './allow-unlicensed.decorator';

@AllowUnlicensed()
@Controller('licensing')
export class LicensingController {
  constructor(private readonly licensing: LicensingService) {}

  @Get('status')
  status(@CurrentUser() user: RequestUser) {
    return this.licensing.status(user.establishmentId);
  }

  @Post('activate')
  @RequirePermissions(PermissionCode.LICENSE_MANAGE)
  activate(@CurrentUser() user: RequestUser, @Body() input: ActivateLicenseDto) {
    return this.licensing.activate(user, input.token);
  }
}

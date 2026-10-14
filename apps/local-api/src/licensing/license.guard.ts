import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { RequestUser } from '../auth/auth.types';
import { ALLOW_UNLICENSED } from './allow-unlicensed.decorator';
import { LicensingService } from './licensing.service';

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly licensing: LicensingService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (process.env.LICENSE_ENFORCEMENT !== 'true') return true;
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_UNLICENSED, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    if (!request.user) return true;
    const status = await this.licensing.status(request.user.establishmentId);
    if (!status.licensed)
      throw new ForbiddenException({ code: 'LICENSE_REQUIRED', reason: status.reason });
    return true;
  }
}

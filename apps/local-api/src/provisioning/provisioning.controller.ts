import { Body, Controller, Get, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { AllowUnlicensed } from '../licensing/allow-unlicensed.decorator';
import { CompleteProvisioningDto } from './provisioning.dto';
import { ProvisioningService } from './provisioning.service';

@Public()
@AllowUnlicensed()
@Controller('provisioning')
export class ProvisioningController {
  constructor(private readonly provisioning: ProvisioningService) {}

  @Get('status')
  status() {
    return this.provisioning.status();
  }

  @Post('complete')
  complete(@Body() input: CompleteProvisioningDto) {
    return this.provisioning.complete(input);
  }
}

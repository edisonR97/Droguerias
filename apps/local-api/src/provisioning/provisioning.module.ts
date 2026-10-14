import { Module } from '@nestjs/common';
import { ProvisioningController } from './provisioning.controller';
import { ProvisioningService } from './provisioning.service';

@Module({ controllers: [ProvisioningController], providers: [ProvisioningService] })
export class ProvisioningModule {}

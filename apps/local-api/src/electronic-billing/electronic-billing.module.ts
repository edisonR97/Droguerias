import { Module } from '@nestjs/common';
import { ElectronicBillingController } from './electronic-billing.controller';
import { ElectronicBillingService } from './electronic-billing.service';

@Module({ controllers: [ElectronicBillingController], providers: [ElectronicBillingService] })
export class ElectronicBillingModule {}

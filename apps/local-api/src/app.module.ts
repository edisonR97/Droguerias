import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { PosModule } from './pos/pos.module';
import { CustomersModule } from './customers/customers.module';
import { PurchasesModule } from './purchases/purchases.module';
import { TransfersModule } from './transfers/transfers.module';
import { CountsModule } from './counts/counts.module';
import { ReturnsModule } from './returns/returns.module';
import { AdminModule } from './admin/admin.module';
import { ReportsModule } from './reports/reports.module';
import { AccountingModule } from './accounting/accounting.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { LicensingModule } from './licensing/licensing.module';
import { LicenseGuard } from './licensing/license.guard';
import { ElectronicBillingModule } from './electronic-billing/electronic-billing.module';
import { ProvisioningModule } from './provisioning/provisioning.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    AuthModule,
    DashboardModule,
    ProductsModule,
    InventoryModule,
    PosModule,
    CustomersModule,
    PurchasesModule,
    TransfersModule,
    CountsModule,
    ReturnsModule,
    AdminModule,
    ReportsModule,
    AccountingModule,
    PortfolioModule,
    LicensingModule,
    ElectronicBillingModule,
    ProvisioningModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: LicenseGuard },
  ],
})
export class AppModule {}

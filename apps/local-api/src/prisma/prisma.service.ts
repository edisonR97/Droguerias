import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ensureSystemAccess } from '../auth/system-access';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    await ensureSystemAccess(this);
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

import { Module } from '@nestjs/common';
import { CountsController } from './counts.controller';
import { CountsService } from './counts.service';
@Module({ controllers: [CountsController], providers: [CountsService] })
export class CountsModule {}

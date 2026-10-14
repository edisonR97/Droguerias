import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class RegisterPortfolioPaymentDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
  @IsIn(['CASH', 'CARD', 'TRANSFER']) method!: 'CASH' | 'CARD' | 'TRANSFER';
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsString() @MaxLength(120) idempotencyKey!: string;
}

export class PortfolioIdDto {
  @IsUUID() id!: string;
}

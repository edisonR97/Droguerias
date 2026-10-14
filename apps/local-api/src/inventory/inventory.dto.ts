import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class ReceiveInventoryDto {
  @IsUUID() branchId!: string;
  @IsUUID() productId!: string;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsUUID() locationId?: string;
  @IsString() @MaxLength(100) lotNumber!: string;
  @Type(() => Date) @IsDate() expiresAt!: Date;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 6 }) @Min(0.000001) quantity!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 6 }) @Min(0) unitCost!: number;
  @IsString() @MaxLength(200) reason!: string;
  @IsString() @MaxLength(120) idempotencyKey!: string;
  @IsOptional() @IsString() @MaxLength(80) referenceType?: string;
  @IsOptional() @IsString() @MaxLength(120) referenceId?: string;
}

export class FefoQueryDto {
  @IsUUID() branchId!: string;
  @IsUUID() productId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 6 }) @Min(0.000001) quantity!: number;
}

export class InventoryQueryDto {
  @IsUUID() branchId!: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @Min(1) quantity = 50;
}

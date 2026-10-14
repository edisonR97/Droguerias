import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
class PurchaseItemDto {
  @IsUUID() productId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 6 }) @Min(0.000001) quantity!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 6 }) @Min(0) unitCost!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) taxRate!: number;
}
export class CreatePurchaseOrderDto {
  @IsUUID() branchId!: string;
  @IsUUID() supplierId!: string;
  @IsOptional() @Type(() => Date) @IsDate() expectedAt?: Date;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
}
class ReceivePurchaseItemDto {
  @IsUUID() itemId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 6 }) @Min(0.000001) quantity!: number;
  @IsString() @MaxLength(100) lotNumber!: string;
  @Type(() => Date) @IsDate() expiresAt!: Date;
}
export class ReceivePurchaseDto {
  @IsString() @MaxLength(120) idempotencyKey!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseItemDto)
  items!: ReceivePurchaseItemDto[];
}
export class CreateSupplierDto {
  @IsString() @MaxLength(30) taxId!: string;
  @IsString() @MaxLength(200) legalName!: string;
  @IsOptional() @IsString() @MaxLength(200) tradeName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

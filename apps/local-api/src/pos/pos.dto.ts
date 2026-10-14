import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ElectronicDocumentType, PaymentMethod } from '@prisma/client';

export class OpenCashSessionDto {
  @IsUUID() branchId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) openingAmount!: number;
}

export class CheckoutItemDto {
  @IsUUID() productId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 6 }) @Min(0.000001) quantity!: number;
}

export class CheckoutDto {
  @IsUUID() branchId!: string;
  @IsUUID() cashSessionId!: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsEnum(PaymentMethod) paymentMethod!: PaymentMethod;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) receivedAmount!: number;
  @IsString() @MaxLength(120) idempotencyKey!: string;
  @IsOptional() @IsEnum(ElectronicDocumentType) documentType?: ElectronicDocumentType;
}

export class CloseCashSessionDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) closingAmount!: number;
}

export class VoidSaleDto {
  @IsString() @MaxLength(300) reason!: string;
}

import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsUUID() categoryId!: string;
  @IsOptional() @IsUUID() laboratoryId?: string;
  @IsString() @MaxLength(60) internalCode!: string;
  @IsOptional() @IsString() @MaxLength(80) barcode?: string;
  @IsString() @MaxLength(200) commercialName!: string;
  @IsOptional() @IsString() @MaxLength(200) genericName?: string;
  @IsOptional() @IsString() @MaxLength(200) activeIngredient?: string;
  @IsOptional() @IsString() @MaxLength(100) concentration?: string;
  @IsString() @MaxLength(150) presentation!: string;
  @IsOptional() @IsString() @MaxLength(150) manufacturer?: string;
  @IsOptional() @IsString() @MaxLength(100) sanitaryRegistration?: string;
  @IsOptional() @Type(() => Date) @IsDate() sanitaryRegistrationExpiresAt?: Date;
  @IsOptional() @IsString() @MaxLength(50) purchaseUnit?: string;
  @IsOptional() @IsString() @MaxLength(50) saleUnit?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 6 }) @Min(0.000001) unitsPerPurchase!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) salePrice!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(100) taxRate!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 6 }) @Min(0) minimumStock!: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  maximumStock?: number;
  @IsOptional() @IsString() @MaxLength(300) storageConditions?: string;
  @IsOptional() @IsString() @MaxLength(150) physicalLocationHint?: string;
  @IsOptional() @IsBoolean() prescriptionRequired?: boolean;
  @IsOptional() @IsBoolean() controlledSubstance?: boolean;
}

export class ProductQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @Min(1) @Max(100) limit = 25;
}

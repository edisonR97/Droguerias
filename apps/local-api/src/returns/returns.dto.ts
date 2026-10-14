import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
class ReturnItemDto {
  @IsUUID() saleItemId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 6 }) @Min(0.000001) quantity!: number;
}
export class CreateReturnDto {
  @IsUUID() saleId!: string;
  @IsString() @MaxLength(300) reason!: string;
  @IsString() @MaxLength(120) idempotencyKey!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];
}

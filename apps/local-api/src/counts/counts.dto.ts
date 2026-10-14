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
class CountItem {
  @IsUUID() batchId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 6 }) @Min(0) countedQuantity!: number;
}
export class CreateCountDto {
  @IsUUID() branchId!: string;
  @IsString() @MaxLength(300) reason!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CountItem)
  items!: CountItem[];
}

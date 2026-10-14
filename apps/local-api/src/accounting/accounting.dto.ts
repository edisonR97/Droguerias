import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateAccountDto {
  @IsString() @MaxLength(30) code!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsIn(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])
  type!: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  @IsOptional() @IsUUID() parentId?: string;
}

class JournalLineDto {
  @IsUUID() accountId!: string;
  @IsOptional() @IsString() @MaxLength(240) description?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) debit = 0;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) credit = 0;
}

export class CreateJournalEntryDto {
  @Type(() => Date) @IsDate() date!: Date;
  @IsString() @MaxLength(300) description!: string;
  @IsOptional() @IsString() @MaxLength(80) referenceType?: string;
  @IsOptional() @IsString() @MaxLength(120) referenceId?: string;
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class TrialBalanceQueryDto {
  @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @IsOptional() @Type(() => Date) @IsDate() to?: Date;
}

export class ReverseEntryDto {
  @IsString() @MaxLength(300) reason!: string;
}

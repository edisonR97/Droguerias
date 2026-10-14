import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MaxLength(120) displayName!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) roleCodes!: string[];
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @IsOptional() @IsIn(['ACTIVE', 'LOCKED', 'DISABLED']) status?: 'ACTIVE' | 'LOCKED' | 'DISABLED';
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsString({ each: true }) roleCodes?: string[];
}

export class ResetPasswordDto {
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
}

export class CreateBranchDto {
  @IsString() @Length(2, 30) code!: string;
  @IsString() @Length(2, 120) name!: string;
}

export class UpdateBranchDto {
  @IsOptional() @IsString() @Length(2, 30) code?: string;
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() active?: boolean;
}

export class UpdateEstablishmentDto {
  @IsString() @Length(2, 160) legalName!: string;
  @IsString() @Length(2, 160) tradeName!: string;
  @IsString() @Length(3, 30) taxId!: string;
  @IsString() @MaxLength(80) timezone!: string;
  @IsString() @Length(3, 3) currency!: string;
}

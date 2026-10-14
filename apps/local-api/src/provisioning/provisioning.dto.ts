import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class CompleteProvisioningDto {
  @IsString() @MinLength(32) @MaxLength(256) setupToken!: string;
  @IsString() @Length(2, 160) legalName!: string;
  @IsString() @Length(2, 160) tradeName!: string;
  @IsString() @Length(3, 30) taxId!: string;
  @IsString() @Length(2, 30) branchCode!: string;
  @IsString() @Length(2, 120) branchName!: string;
  @IsEmail() @MaxLength(254) ownerEmail!: string;
  @IsString() @Length(2, 120) ownerName!: string;
  @IsString() @MinLength(12) @MaxLength(128) ownerPassword!: string;
}

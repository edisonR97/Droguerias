import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
export class CreateCustomerDto {
  @IsString() @MaxLength(10) documentType!: string;
  @IsString() @MaxLength(30) documentNumber!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(200) email?: string;
}

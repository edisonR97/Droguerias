import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
export class LoginDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(10) @MaxLength(128) password!: string;
}

export class RefreshTokenDto {
  @IsString() @MinLength(40) @MaxLength(4096) refreshToken!: string;
}

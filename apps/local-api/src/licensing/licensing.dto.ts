import { IsString, MaxLength, MinLength } from 'class-validator';

export class ActivateLicenseDto {
  @IsString()
  @MinLength(40)
  @MaxLength(16_384)
  token!: string;
}

import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNLICENSED = 'allowUnlicensed';
export const AllowUnlicensed = () => SetMetadata(ALLOW_UNLICENSED, true);

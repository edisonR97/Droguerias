import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto, RefreshTokenDto } from './login.dto';
import { Public } from './public.decorator';
import type { RequestUser } from './auth.types';
import { AllowUnlicensed } from '../licensing/allow-unlicensed.decorator';

@ApiTags('auth')
@AllowUnlicensed()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('login') login(@Body() input: LoginDto) {
    return this.auth.login(input);
  }
  @Public() @Post('refresh') refresh(@Body() input: RefreshTokenDto) {
    return this.auth.refresh(input);
  }
  @ApiBearerAuth() @Post('logout') logout(@CurrentUser() user: RequestUser) {
    return this.auth.logout(user);
  }
  @ApiBearerAuth() @Get('me') me(@CurrentUser() user: RequestUser) {
    return user;
  }
}

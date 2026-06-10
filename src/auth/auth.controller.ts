import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CookieOptions, Request, Response } from 'express';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ACCESS_TOKEN_COOKIE, REFRESH_COOKIE_PATH, REFRESH_TOKEN_COOKIE } from './auth.constants';
import { AuthResult, AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

const AUTH_THROTTLE = { default: { ttl: 60_000, limit: 10 } };

@ApiTags('auth')
@ApiTooManyRequestsResponse({ description: 'Auth endpoints allow 10 requests per minute' })
@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    this.isProduction = configService.get<string>('app.env') === 'production';
  }

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Create an account; sets httpOnly auth cookies' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid email or password shorter than 8 characters' })
  @ApiConflictResponse({ description: 'An account with this email already exists' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(registerDto);
    return this.respondWithTokens(response, result);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Log in; sets httpOnly auth cookies' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(loginDto);
    return this.respondWithTokens(response, result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Rotate the refresh token cookie and issue a new access token' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid or revoked refresh token' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE];
    const result = await this.authService.refresh(refreshToken);
    return this.respondWithTokens(response, result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke the refresh token and clear auth cookies' })
  @ApiOkResponse({ description: 'Logged out' })
  @ApiUnauthorizedResponse({ description: 'Missing or expired credentials' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    await this.authService.logout(user.userId);
    response.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions());
    response.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions(REFRESH_COOKIE_PATH));
    return { message: 'Logged out' };
  }

  private respondWithTokens(response: Response, result: AuthResult): AuthResponseDto {
    response.cookie(ACCESS_TOKEN_COOKIE, result.accessToken, {
      ...this.cookieOptions(),
      maxAge: this.authService.accessTokenTtlMs,
    });
    response.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
      ...this.cookieOptions(REFRESH_COOKIE_PATH),
      maxAge: this.authService.refreshTokenTtlMs,
    });
    return { accessToken: result.accessToken, user: result.user };
  }

  private cookieOptions(path = '/'): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      path,
    };
  }
}

import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description:
      'JWT access token. Also set as an httpOnly cookie; the bearer header is supported ' +
      'as an alternative for non-browser clients.',
  })
  accessToken: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}

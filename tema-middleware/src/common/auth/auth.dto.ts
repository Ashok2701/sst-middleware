import { ApiProperty } from '@nestjs/swagger';

export class AuthenticatedUserDto {
  @ApiProperty({ example: 'user-123' })
  userId: string;

  @ApiProperty({ required: false, example: 'jane.doe' })
  username?: string;

  @ApiProperty({ required: false, example: 'jane@example.com' })
  email?: string;

  @ApiProperty({ type: [String], example: [] })
  roles: string[];

  @ApiProperty({ type: [String], example: [] })
  permissions: string[];

  @ApiProperty({ example: 'dev' })
  identityProvider: string;
}

export class WhoAmIResponse {
  @ApiProperty({ example: true })
  authenticated: boolean;

  @ApiProperty({ required: false, type: AuthenticatedUserDto })
  user?: AuthenticatedUserDto;

  @ApiProperty({ required: false, example: 'Authentication is disabled' })
  message?: string;
}

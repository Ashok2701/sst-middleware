import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SalesRepLoginRequest {
  @ApiProperty({ example: 'SREP01', description: 'Sales Rep login (XAUS_0)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username: string;

  @ApiProperty({ description: 'Sales Rep password', format: 'password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}

export class SalesRepIdentityDto {
  @ApiProperty({ example: 'SREP01' })
  salesRepId: string;

  @ApiProperty({ example: 'SREP01' })
  username: string;

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty({ example: 'Sales Rep' })
  role: string;

  @ApiProperty({ type: [String], example: ['USA01', 'USA02'] })
  sites: string[];

  @ApiProperty({ required: false, example: 'USA01' })
  defaultSite?: string;
}

export class SalesRepLoginResponse {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 3600 })
  expiresIn: number;

  @ApiProperty({ type: SalesRepIdentityDto })
  user: SalesRepIdentityDto;
}

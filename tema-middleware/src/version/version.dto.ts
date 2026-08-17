import { ApiProperty } from '@nestjs/swagger';

export class VersionResponse {
  @ApiProperty({ example: 'tema-middleware' })
  service: string;

  @ApiProperty({ example: '0.1.0' })
  version: string;
}

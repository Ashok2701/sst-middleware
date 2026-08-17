import { ApiProperty } from '@nestjs/swagger';

export class HealthResponse {
  @ApiProperty({ example: 'UP' })
  status: string;

  @ApiProperty({ example: 'tema-middleware' })
  service: string;
}

export class ReadinessResponse {
  @ApiProperty({ example: 'READY' })
  status: string;

  @ApiProperty({ example: 'tema-middleware' })
  service: string;

  @ApiProperty({
    description: 'Individual readiness checks (empty in Phase 1).',
    type: 'array',
    items: { type: 'object' },
    example: [],
  })
  checks: unknown[];
}

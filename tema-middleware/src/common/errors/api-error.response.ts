import { ApiProperty } from '@nestjs/swagger';

/** Consistent error response returned to API consumers. */
export class ApiErrorResponse {
  @ApiProperty({
    example: 'INTERNAL_ERROR',
    description: 'Stable, machine-readable error code.',
  })
  code: string;

  @ApiProperty({
    example: 'An unexpected error occurred',
    description: 'Human-readable, safe error message (no internal details).',
  })
  message: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Correlation / request id for tracing this call.',
  })
  requestId: string;

  @ApiProperty({
    required: false,
    description: 'Optional field-level validation details.',
    type: 'array',
    items: { type: 'object' },
  })
  details?: unknown;
}

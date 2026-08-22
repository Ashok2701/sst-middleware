import { ApiProperty } from '@nestjs/swagger';

/** Safe webhook acknowledgement returned to WorkSuite. Exposes no secrets. */
export class WorksuiteWebhookResponse {
  @ApiProperty({ example: true })
  accepted: boolean;

  @ApiProperty({ example: 'evt_01HXY...' })
  eventId: string;

  @ApiProperty({ example: 'contractor.updated' })
  event: string;

  @ApiProperty({ example: 'processed', enum: ['processed', 'ignored'] })
  status: string;
}

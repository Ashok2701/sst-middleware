import { ApiProperty } from '@nestjs/swagger';
import { IntegrationStatus } from '../common/integration/models/integration-health';

export class IntegrationHealthItem {
  @ApiProperty({ example: 'sql-server' })
  name: string;

  @ApiProperty({ example: 'SQL Server' })
  targetSystem: string;

  @ApiProperty({ enum: IntegrationStatus, example: IntegrationStatus.Disabled })
  status: IntegrationStatus;

  @ApiProperty({ example: false })
  enabled: boolean;

  @ApiProperty({ required: false, example: 12 })
  latencyMs?: number;

  @ApiProperty({ required: false, example: 'Integration disabled' })
  message?: string;
}

export class IntegrationHealthResponse {
  @ApiProperty({ type: [IntegrationHealthItem] })
  integrations: IntegrationHealthItem[];
}

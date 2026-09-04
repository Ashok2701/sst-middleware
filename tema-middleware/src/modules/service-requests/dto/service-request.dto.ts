import { ApiProperty } from '@nestjs/swagger';

export class ServiceRequestSummaryDto {
  @ApiProperty({ example: 'SRE0000123' })
  serviceRequestNumber: string;
  @ApiProperty({ required: false })
  description?: string;
  @ApiProperty({ required: false })
  status?: number;
  @ApiProperty({ required: false })
  serviceDate?: string;
  @ApiProperty({ required: false })
  reservationDate?: string;
  @ApiProperty({ required: false })
  createdDate?: string;
  @ApiProperty({ required: false })
  site?: string;
  @ApiProperty({ required: false })
  customer?: string;
  @ApiProperty({ required: false })
  address?: string;
  @ApiProperty({ required: false })
  routeNumber?: string;
}

export class ServiceRequestListResponse {
  @ApiProperty({ type: [ServiceRequestSummaryDto] })
  serviceRequests: ServiceRequestSummaryDto[];
  @ApiProperty({ example: 1 })
  count: number;
}

export class ServiceRequestDetailResponse extends ServiceRequestSummaryDto {
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  bases: Record<string, unknown>[];
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  tasks: Record<string, unknown>[];
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  jobCards: Record<string, unknown>[];
}

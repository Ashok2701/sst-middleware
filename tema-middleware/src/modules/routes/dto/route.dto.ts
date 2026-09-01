import { ApiProperty } from '@nestjs/swagger';

export class RouteHeaderDto {
  @ApiProperty({ example: 'RT-USA01-0001' })
  xdrn: string;
  @ApiProperty({ required: false, example: 1 })
  status?: number;
  @ApiProperty({ required: false })
  routeDate?: string;
  @ApiProperty({ required: false })
  technicianId?: string;
  @ApiProperty({ required: false })
  technicianName?: string;
  @ApiProperty({ required: false })
  site?: string;
  @ApiProperty({ required: false })
  trip?: number;
  @ApiProperty({ required: false })
  createdBy?: string;
}

export class RouteListResponse {
  @ApiProperty({ type: [RouteHeaderDto] })
  routes: RouteHeaderDto[];
  @ApiProperty({ example: 1 })
  count: number;
}

export class RouteDetailResponse extends RouteHeaderDto {
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  details: Record<string, unknown>[];
}

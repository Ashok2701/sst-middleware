import { ApiProperty } from '@nestjs/swagger';

export class TechnicianDto {
  @ApiProperty({ example: 'T-1001' })
  technicianId: string;

  @ApiProperty({ required: false, example: 'Jane Doe' })
  name?: string;

  @ApiProperty({ required: false, example: 'ACTIVE' })
  status?: string;

  @ApiProperty({ required: false, example: 'Denver' })
  branch?: string;

  @ApiProperty({ required: false, example: 'Mountain' })
  region?: string;

  @ApiProperty({ required: false, example: 'Crew-7' })
  crew?: string;

  @ApiProperty({
    required: false,
    type: [String],
    example: ['install', 'service'],
  })
  skills?: string[];
}

export class TechniciansResponse {
  @ApiProperty({ type: [TechnicianDto] })
  technicians: TechnicianDto[];

  @ApiProperty({ example: 1 })
  count: number;
}

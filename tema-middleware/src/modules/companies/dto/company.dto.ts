import { ApiProperty } from '@nestjs/swagger';

export class CompanyDto {
  @ApiProperty({ example: 'CREW001' })
  crewId: string;
  @ApiProperty({ required: false, example: 'North Team' })
  name?: string;
  @ApiProperty({ required: false, example: 'USA01' })
  site?: string;
  @ApiProperty({ required: false, example: true })
  active?: boolean;
}

export class CompanyTechnicianDto {
  @ApiProperty({ example: '7051' })
  technicianId: string;
  @ApiProperty({ required: false })
  name?: string;
  @ApiProperty({ example: false })
  leadTechnician: boolean;
  @ApiProperty({ required: false })
  skillType?: string;
  @ApiProperty({ required: false })
  certification?: string;
  @ApiProperty({ required: false })
  email?: string;
}

export class CompanyListResponse {
  @ApiProperty({ type: [CompanyDto] })
  companies: CompanyDto[];
  @ApiProperty({ example: 1 })
  count: number;
}

export class CompanyDetailResponse extends CompanyDto {
  @ApiProperty({ type: [CompanyTechnicianDto] })
  technicians: CompanyTechnicianDto[];
}

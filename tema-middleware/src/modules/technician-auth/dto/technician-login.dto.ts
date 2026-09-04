import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TechnicianLoginRequest {
  @ApiProperty({
    example: 'jdoe',
    description: 'Technician login username (XTECHNCN_0)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username: string;

  @ApiProperty({ description: 'Technician password', format: 'password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}

export class TechnicianIdentityDto {
  @ApiProperty({
    example: 'TECH001',
    description: 'X3 technician id (XTECH_0)',
  })
  technicianId: string;

  @ApiProperty({ example: 'jdoe', description: 'Login username (XTECHNCN_0)' })
  username: string;

  @ApiProperty({ required: false, description: 'Technician name (XTECHNAM_0)' })
  name?: string;

  @ApiProperty({ required: false, description: 'Crew/company id (XCREWID_0)' })
  crewId?: string;

  @ApiProperty({
    example: 'Technician',
    enum: ['Lead Technician', 'Technician'],
  })
  role: string;
}

export class TechnicianCrewDto {
  @ApiProperty({ example: 'CREW001' })
  crewId: string;
  @ApiProperty({ required: false })
  name?: string;
  @ApiProperty({ required: false })
  site?: string;
  @ApiProperty({ required: false })
  active?: boolean;
}

export class TechnicianLoginResponse {
  @ApiProperty({ description: 'Bearer access token (JWT)' })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 3600, description: 'Token lifetime in seconds' })
  expiresIn: number;

  @ApiProperty({ type: TechnicianIdentityDto })
  user: TechnicianIdentityDto;

  @ApiProperty({
    type: TechnicianCrewDto,
    required: false,
    description: "Technician's crew/company (FSM.XCREW via XCREWID_0)",
  })
  crew?: TechnicianCrewDto;
}

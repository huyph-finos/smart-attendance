import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  Min,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty({ example: 'Head Office' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'HO-001' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: '123 Main St, Ho Chi Minh City' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 10.7769 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: 106.7009 })
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional({ example: 200, description: 'Geofence radius in meters' })
  @IsOptional()
  @IsInt()
  @Min(50)
  radius?: number;

  @ApiPropertyOptional({ example: '08:00', description: 'Work start time (HH:mm)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'workStartTime must be in HH:mm format' })
  workStartTime?: string;

  @ApiPropertyOptional({ example: '17:00', description: 'Work end time (HH:mm)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'workEndTime must be in HH:mm format' })
  workEndTime?: string;

  @ApiPropertyOptional({ example: 15, description: 'Late threshold in minutes' })
  @IsOptional()
  @IsInt()
  @Min(0)
  lateThreshold?: number;
}

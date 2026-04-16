import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveType } from '@prisma/client';

export class CreateLeaveDto {
  @ApiProperty({ enum: LeaveType })
  @IsEnum(LeaveType)
  type: LeaveType;

  @ApiProperty({ example: '2026-04-20' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-04-21' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

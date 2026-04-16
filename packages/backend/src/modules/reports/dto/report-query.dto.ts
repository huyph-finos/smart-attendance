import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReportQueryDto {
  @ApiPropertyOptional({
    description: 'Date in YYYY-MM-DD format',
    example: '2026-04-16',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Monday of the week in YYYY-MM-DD format',
    example: '2026-04-13',
  })
  @IsOptional()
  @IsString()
  weekOf?: string;

  @ApiPropertyOptional({
    description: 'Month (1-12)',
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({
    description: 'Year',
    example: 2026,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year?: number;

  @ApiPropertyOptional({ description: 'Filter by branch ID' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Export format',
    enum: ['json', 'csv', 'xlsx'],
    default: 'json',
  })
  @IsOptional()
  @IsIn(['json', 'csv', 'xlsx'])
  format?: 'json' | 'csv' | 'xlsx';
}

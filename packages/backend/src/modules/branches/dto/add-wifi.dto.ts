import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddWifiDto {
  @ApiProperty({ example: 'Office-WiFi' })
  @IsString()
  @IsNotEmpty()
  ssid: string;

  @ApiProperty({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsString()
  @IsNotEmpty()
  bssid: string;

  @ApiPropertyOptional({ example: 'Floor 3' })
  @IsOptional()
  @IsString()
  floor?: string;
}

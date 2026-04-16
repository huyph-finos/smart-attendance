import {
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  IsLatitude,
  IsLongitude,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckInDto {
  @ApiProperty({ description: 'User latitude', example: 10.7769 })
  @IsNumber()
  @IsLatitude()
  latitude: number;

  @ApiProperty({ description: 'User longitude', example: 106.7009 })
  @IsNumber()
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ description: 'Connected WiFi SSID' })
  @IsOptional()
  @IsString()
  wifiSsid?: string;

  @ApiPropertyOptional({ description: 'Connected WiFi BSSID (MAC address)' })
  @IsOptional()
  @IsString()
  wifiBssid?: string;

  @ApiProperty({ description: 'Unique device fingerprint' })
  @IsString()
  deviceFingerprint: string;

  @ApiPropertyOptional({
    description: 'Whether mock location was detected on device',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  mockLocationDetected?: boolean = false;

  @ApiPropertyOptional({ description: 'User mood at check-in' })
  @IsOptional()
  @IsString()
  mood?: string;
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @ApiOperation({ summary: 'Check in with anti-fraud verification' })
  @ApiResponse({ status: 201, description: 'Check-in successful' })
  @ApiResponse({ status: 403, description: 'Check-in blocked by anti-fraud' })
  @ApiResponse({ status: 409, description: 'Already checked in today' })
  checkIn(
    @CurrentUser('id') userId: string,
    @Body() dto: CheckInDto,
  ) {
    return this.attendanceService.checkIn(userId, dto);
  }

  @Post('check-out')
  @ApiOperation({ summary: 'Check out with anti-fraud verification' })
  @ApiResponse({ status: 201, description: 'Check-out successful' })
  @ApiResponse({ status: 404, description: 'No check-in found for today' })
  @ApiResponse({ status: 409, description: 'Already checked out today' })
  checkOut(
    @CurrentUser('id') userId: string,
    @Body() dto: CheckInDto,
  ) {
    return this.attendanceService.checkOut(userId, dto);
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's attendance record" })
  @ApiResponse({ status: 200, description: "Today's attendance or null" })
  getToday(@CurrentUser('id') userId: string) {
    return this.attendanceService.getToday(userId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get own attendance history (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated attendance records' })
  getHistory(
    @CurrentUser('id') userId: string,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.attendanceService.getHistory(userId, query);
  }

  @Get('user/:id/history')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get attendance history for a specific user (Manager/Admin)' })
  @ApiResponse({ status: 200, description: 'Paginated attendance records' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  getUserHistory(
    @Param('id', ParseUUIDPipe) targetUserId: string,
    @Query() query: AttendanceQueryDto,
    @CurrentUser() requestingUser: { id: string; role: string; branchId?: string },
  ) {
    return this.attendanceService.getUserHistory(
      targetUserId,
      query,
      requestingUser,
    );
  }

  @Post('bulk-sync')
  @ApiOperation({ summary: 'Sync offline attendance records' })
  @ApiResponse({ status: 201, description: 'Bulk sync results' })
  bulkSync(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      records: Array<{
        date: string;
        checkInTime: string;
        checkOutTime?: string;
        latitude: number;
        longitude: number;
        wifiBssid?: string;
        deviceFingerprint: string;
        mood?: string;
      }>;
    },
  ) {
    return this.attendanceService.bulkSync(userId, body.records);
  }
}

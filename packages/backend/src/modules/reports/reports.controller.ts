import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily')
  @ApiOperation({ summary: 'Get daily attendance report' })
  @ApiResponse({ status: 200, description: 'Daily report data' })
  getDaily(
    @Query('date') date: string,
    @Query('branchId') branchId?: string,
  ) {
    const reportDate = date || new Date().toISOString().split('T')[0];
    return this.reportsService.getDaily(reportDate, branchId);
  }

  @Get('weekly')
  @ApiOperation({ summary: 'Get weekly attendance report' })
  @ApiResponse({ status: 200, description: 'Weekly report data' })
  getWeekly(
    @Query('weekOf') weekOf: string,
    @Query('branchId') branchId?: string,
  ) {
    // Default to current week's Monday
    if (!weekOf) {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      weekOf = monday.toISOString().split('T')[0];
    }
    return this.reportsService.getWeekly(weekOf, branchId);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Get monthly attendance report' })
  @ApiResponse({ status: 200, description: 'Monthly report data' })
  getMonthly(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('branchId') branchId?: string,
  ) {
    const now = new Date();
    const reportMonth = month ? parseInt(month, 10) : now.getMonth() + 1;
    const reportYear = year ? parseInt(year, 10) : now.getFullYear();
    return this.reportsService.getMonthly(reportMonth, reportYear, branchId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get system-wide attendance summary' })
  @ApiResponse({ status: 200, description: 'Summary data' })
  getSummary(@Query('branchId') branchId?: string) {
    return this.reportsService.getSummary(branchId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export attendance report as Excel file' })
  @ApiResponse({ status: 200, description: 'Excel file download' })
  async exportReport(
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportReport(query);

    const filename = `attendance-report-${Date.now()}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}

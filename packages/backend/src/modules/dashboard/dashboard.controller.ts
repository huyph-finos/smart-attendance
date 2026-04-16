import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: "Get today's real-time attendance overview" })
  @ApiResponse({ status: 200, description: 'Dashboard overview stats' })
  @ApiQuery({ name: 'branchId', required: false })
  getOverview(
    @Query('branchId') branchId: string | undefined,
    @CurrentUser() user: { id: string; role: string; branchId?: string },
  ) {
    // Managers auto-filter by their own branch
    const effectiveBranchId =
      user.role === 'MANAGER' ? user.branchId : branchId;
    return this.dashboardService.getOverview(effectiveBranchId);
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get attendance trends for charts' })
  @ApiResponse({ status: 200, description: 'Array of daily trend data' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getTrends(
    @Query('branchId') branchId: string | undefined,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @CurrentUser() user: { id: string; role: string; branchId?: string },
  ) {
    const effectiveBranchId =
      user.role === 'MANAGER' ? user.branchId : branchId;
    return this.dashboardService.getTrends(effectiveBranchId, days);
  }

  @Get('branch-heatmap')
  @ApiOperation({ summary: 'Get branch attendance heatmap data' })
  @ApiResponse({ status: 200, description: 'Branch heatmap array' })
  getBranchHeatmap() {
    return this.dashboardService.getBranchHeatmap();
  }

  @Get('live-feed')
  @ApiOperation({ summary: 'Get live attendance event feed' })
  @ApiResponse({ status: 200, description: 'Array of recent attendance events' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getLiveFeed(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.dashboardService.getLiveFeed(limit);
  }
}

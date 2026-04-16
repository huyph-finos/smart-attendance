import {
  Controller,
  Get,
  Patch,
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
  ApiQuery,
} from '@nestjs/swagger';
import { Role, AnomalyType, AnomalySeverity } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnomaliesService } from './anomalies.service';

@ApiTags('anomalies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('anomalies')
export class AnomaliesController {
  constructor(private readonly anomaliesService: AnomaliesService) {}

  @Get()
  @ApiOperation({ summary: 'List anomalies (paginated, with filters)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'severity', required: false, enum: AnomalySeverity })
  @ApiQuery({ name: 'type', required: false, enum: AnomalyType })
  @ApiQuery({ name: 'isResolved', required: false, type: Boolean })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of anomalies' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('severity') severity?: AnomalySeverity,
    @Query('type') type?: AnomalyType,
    @Query('isResolved') isResolved?: string,
    @Query('branchId') branchId?: string,
    @CurrentUser() user?: { id: string; role: string; branchId?: string },
  ) {
    return this.anomaliesService.findAll(
      {
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        severity,
        type,
        isResolved: isResolved !== undefined ? isResolved === 'true' : undefined,
        branchId,
      },
      user!,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get anomaly statistics' })
  @ApiResponse({ status: 200, description: 'Anomaly stats: total, unresolved, critical, high' })
  getStats(
    @CurrentUser() user: { id: string; role: string; branchId?: string },
  ) {
    return this.anomaliesService.getStats(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get anomaly detail' })
  @ApiResponse({ status: 200, description: 'Anomaly detail with attendance and user info' })
  @ApiResponse({ status: 404, description: 'Anomaly not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.anomaliesService.findOne(id);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve an anomaly' })
  @ApiResponse({ status: 200, description: 'Anomaly resolved' })
  @ApiResponse({ status: 404, description: 'Anomaly not found' })
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { resolvedNote: string },
  ) {
    return this.anomaliesService.resolve(id, userId, body.resolvedNote);
  }
}

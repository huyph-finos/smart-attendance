import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Role, ShiftType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShiftsService } from './shifts.service';

@ApiTags('shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @ApiOperation({ summary: 'List shift templates' })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of shift templates' })
  findAll(@Query('branchId') branchId?: string) {
    return this.shiftsService.findAll(branchId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Create a shift template' })
  @ApiResponse({ status: 201, description: 'Shift created' })
  create(
    @Body()
    body: {
      branchId: string;
      name: string;
      type: ShiftType;
      startTime: string;
      endTime: string;
    },
  ) {
    return this.shiftsService.create(body);
  }

  @Post('assign')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Assign employees to shifts' })
  @ApiResponse({ status: 201, description: 'Shift assignments created' })
  assign(
    @Body()
    body: {
      assignments: Array<{ userId: string; shiftId: string; date: string }>;
    },
  ) {
    return this.shiftsService.assign(body.assignments);
  }

  @Get('schedule')
  @ApiOperation({ summary: 'Get weekly schedule' })
  @ApiQuery({ name: 'branchId', required: true, type: String })
  @ApiQuery({ name: 'weekOf', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Weekly schedule grouped by date' })
  getSchedule(
    @Query('branchId') branchId: string,
    @Query('weekOf') weekOf: string,
  ) {
    return this.shiftsService.getWeeklySchedule(branchId, weekOf);
  }
}

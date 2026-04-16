import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { PaginationDto } from '../../common/dto/pagination.dto';
import { LeavesService } from './leaves.service';
import { CreateLeaveDto } from './dto/create-leave.dto';

@ApiTags('leaves')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a leave request' })
  @ApiResponse({ status: 201, description: 'Leave request created' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateLeaveDto,
  ) {
    return this.leavesService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get my leave requests (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated leave records' })
  findMyLeaves(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.leavesService.findMyLeaves(userId, pagination);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get pending leave approvals (Manager/Admin)' })
  @ApiResponse({ status: 200, description: 'Paginated pending leave requests' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  findPending(
    @CurrentUser() user: { id: string; role: string; branchId?: string },
    @Query() pagination: PaginationDto,
  ) {
    // Managers see only their branch; admins see all
    const branchId = user.role === Role.MANAGER ? user.branchId : undefined;
    return this.leavesService.findPending(branchId, pagination);
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Approve or reject a leave request (Manager/Admin)' })
  @ApiResponse({ status: 200, description: 'Leave request updated' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { isApproved: boolean },
  ) {
    return this.leavesService.approve(id, userId, body.isApproved);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel own pending leave request' })
  @ApiResponse({ status: 200, description: 'Leave request cancelled' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @ApiResponse({ status: 403, description: 'Not your leave request' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.leavesService.cancel(id, userId);
  }
}

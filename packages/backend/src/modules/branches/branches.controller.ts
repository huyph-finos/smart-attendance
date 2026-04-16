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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '../../generated/prisma';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { AddWifiDto } from './dto/add-wifi.dto';

@ApiTags('branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @ApiOperation({ summary: 'List branches (paginated)' })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('isActive') isActive?: string,
  ) {
    const filters: { isActive?: boolean } = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    return this.branchesService.findAll(pagination, filters);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a branch (Admin only)' })
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get branch detail' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Update a branch (Admin/Manager)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Soft delete a branch (Admin only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.remove(id);
  }

  @Get(':id/employees')
  @ApiOperation({ summary: 'List employees in a branch' })
  getEmployees(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.branchesService.getEmployees(id, pagination);
  }

  @Post(':id/wifi')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Add WiFi config to branch' })
  addWifi(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddWifiDto,
  ) {
    return this.branchesService.addWifi(id, dto);
  }

  @Delete(':id/wifi/:wifiId')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Remove WiFi config from branch' })
  removeWifi(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('wifiId', ParseUUIDPipe) wifiId: string,
  ) {
    return this.branchesService.removeWifi(id, wifiId);
  }

  @Get(':id/dashboard')
  @ApiOperation({ summary: 'Get branch dashboard stats' })
  getDashboard(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.getDashboard(id);
  }
}

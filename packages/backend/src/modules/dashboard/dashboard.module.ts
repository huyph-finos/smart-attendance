import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { DailySummaryService } from './daily-summary.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [DashboardController],
  providers: [DashboardService, DailySummaryService],
  exports: [DashboardService],
})
export class DashboardModule {}

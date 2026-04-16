import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { AttendanceService } from './attendance.service';
import { AntiFraudService } from './anti-fraud.service';
import { AttendanceController } from './attendance.controller';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AntiFraudService],
  exports: [AttendanceService, AntiFraudService],
})
export class AttendanceModule {}

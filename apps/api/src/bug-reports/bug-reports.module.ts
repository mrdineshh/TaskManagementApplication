import { Module } from '@nestjs/common';
import { BugReportsController } from './bug-reports.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BugReportsController],
})
export class BugReportsModule {}

import { Module } from '@nestjs/common';
import { ScorecardsController } from './scorecards.controller';
import { ScorecardsService } from './scorecards.service';
import { HolidayCalendarsModule } from '../holiday-calendars/holiday-calendars.module';

@Module({
  imports: [HolidayCalendarsModule],
  controllers: [ScorecardsController],
  providers: [ScorecardsService],
  exports: [ScorecardsService],
})
export class ScorecardsModule {}

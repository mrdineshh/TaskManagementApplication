import { Body, Controller, Delete, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateHolidayCalendarDto, CreateHolidayDto } from './dto/holiday-calendar.dto';

/**
 * Admin-configurable holiday calendars, keyed by Country+State (docs/10-OPEN-DECISIONS.md §G2).
 * Every User's work_country/work_state picks which calendar governs their business-day/overdue
 * math — built here as plain CRUD; the actual business-day calculation is a later phase.
 */
@ApiTags('holiday-calendars')
@Controller('holiday-calendars')
export class HolidayCalendarsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('holiday_calendar.view')
  list() {
    return this.prisma.holidayCalendar.findMany({
      include: { holidays: { orderBy: { date: 'asc' } } },
      orderBy: [{ country: 'asc' }, { state: 'asc' }],
    });
  }

  @Post()
  @RequirePermission('holiday_calendar.manage')
  create(@Body() dto: CreateHolidayCalendarDto) {
    return this.prisma.holidayCalendar.create({ data: dto });
  }

  @Delete(':id')
  @RequirePermission('holiday_calendar.manage')
  async remove(@Param('id') id: string) {
    const existing = await this.prisma.holidayCalendar.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Holiday calendar not found');
    // No `onDelete: Restrict` guard against in-use calendars — a calendar going away just means
    // its users' overdue math falls back to weekends-only until an Admin picks a new one for
    // them, not a dangling reference (User.workCountry/workState is a plain string pair, not a
    // foreign key into this table).
    await this.prisma.holidayCalendar.delete({ where: { id } });
    return { success: true };
  }

  @Post(':id/holidays')
  @RequirePermission('holiday_calendar.manage')
  async addHoliday(@Param('id') calendarId: string, @Body() dto: CreateHolidayDto) {
    const calendar = await this.prisma.holidayCalendar.findUnique({ where: { id: calendarId } });
    if (!calendar) throw new NotFoundException('Holiday calendar not found');
    return this.prisma.holiday.create({
      data: { calendarId, date: new Date(dto.date), name: dto.name },
    });
  }

  @Delete(':id/holidays/:holidayId')
  @RequirePermission('holiday_calendar.manage')
  async removeHoliday(@Param('id') calendarId: string, @Param('holidayId') holidayId: string) {
    const holiday = await this.prisma.holiday.findUnique({ where: { id: holidayId } });
    if (!holiday || holiday.calendarId !== calendarId) {
      throw new NotFoundException('Holiday not found in this calendar');
    }
    await this.prisma.holiday.delete({ where: { id: holidayId } });
    return { success: true };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Shared lookup for business-day calculations (docs/10-OPEN-DECISIONS.md §I1) — resolves a
 * Country+State pair to its set of holiday dates. Used by overdue detection and the escalation
 * job, not just the admin CRUD controller. */
@Injectable()
export class HolidayCalendarsService {
  constructor(private readonly prisma: PrismaService) {}

  private cache = new Map<string, { dates: Set<string>; expiresAt: number }>();
  private readonly ttlMs = 5 * 60_000; // holiday lists change rarely; short TTL avoids a query per task

  async getHolidayDateKeys(country: string, state: string): Promise<Set<string>> {
    const cacheKey = `${country}::${state}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.dates;

    const calendar = await this.prisma.holidayCalendar.findUnique({
      where: { country_state: { country, state } },
      include: { holidays: true },
    });
    const dates = new Set(calendar?.holidays.map((h) => h.date.toISOString().slice(0, 10)) ?? []);
    this.cache.set(cacheKey, { dates, expiresAt: Date.now() + this.ttlMs });
    return dates;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HolidayCalendarsService } from '../holiday-calendars/holiday-calendars.service';
import { isOverdueOnBusinessDay } from '../common/business-days.util';
import {
  DEFAULT_SCORECARD_WEIGHTS,
  type Scorecard,
  type ScorecardSubScores,
  type ScorecardWeights,
  type LeaderboardEntry,
} from '@taskapp/shared-types';

interface TaskForScoring {
  id: string;
  assigneeId: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  estimateValue: number | null;
  estimateUnit: string | null;
  status: { category: string };
  timeLogs: { minutes: number }[];
}

/**
 * Computes employee scorecards LIVE for an arbitrary [start, end] range and department
 * (docs/10-OPEN-DECISIONS.md §J) — deliberately not built on ReportAggregateCache, which is a
 * fixed-daily-snapshot system that can't serve custom ranges. All six sub-metrics are computed
 * together per department so `volume` (which is scored relative to department peers) is
 * consistent between the single-user and leaderboard endpoints.
 */
@Injectable()
export class ScorecardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly holidayCalendars: HolidayCalendarsService,
  ) {}

  async getConfig(): Promise<{ id: string; weights: ScorecardWeights; updatedAt: Date }> {
    const existing = await this.prisma.scorecardConfig.findFirst();
    if (existing) return existing as { id: string; weights: ScorecardWeights; updatedAt: Date };
    return { id: '', weights: DEFAULT_SCORECARD_WEIGHTS, updatedAt: new Date(0) };
  }

  async updateConfig(weights: ScorecardWeights) {
    const existing = await this.prisma.scorecardConfig.findFirst();
    if (existing) {
      return this.prisma.scorecardConfig.update({ where: { id: existing.id }, data: { weights } });
    }
    return this.prisma.scorecardConfig.create({ data: { weights } });
  }

  /** All scorecards for a department's members over [start, end], keyed by user id. */
  async computeDepartmentScorecards(
    departmentId: string,
    start: Date,
    end: Date,
  ): Promise<Map<string, Scorecard>> {
    const config = await this.getConfig();
    const weights = config.weights;

    const members = await this.prisma.user.findMany({
      where: { primaryDepartmentId: departmentId, isActive: true },
      select: { id: true, fullName: true, workCountry: true, workState: true },
    });
    const memberIds = members.map((m) => m.id);
    if (memberIds.length === 0) return new Map();

    // One shared task fetch covers all six sub-metrics for every member — cheaper than six
    // separate per-user queries, and guarantees volume's peer-relative normalization sees the
    // exact same task set the other five sub-scores were computed from.
    const tasks = (await this.prisma.task.findMany({
      where: {
        assigneeId: { in: memberIds },
        deletedAt: null,
        OR: [
          { completedAt: { gte: start, lte: end } },
          { completedAt: null },
        ],
      },
      select: {
        id: true,
        assigneeId: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        estimateValue: true,
        estimateUnit: true,
        status: { select: { category: true } },
        timeLogs: { select: { minutes: true } },
      },
    })) as unknown as TaskForScoring[];

    const reworkCounts = await this.computeReworkCounts(memberIds, start, end);

    const byUser = new Map<string, TaskForScoring[]>();
    for (const task of tasks) {
      if (!task.assigneeId) continue;
      const list = byUser.get(task.assigneeId) ?? [];
      list.push(task);
      byUser.set(task.assigneeId, list);
    }

    // Volume is scored relative to the department's own peak completions in this range
    // (docs/10-OPEN-DECISIONS.md §J: leaderboard is department-scoped, not company-wide).
    const completedCounts = new Map<string, number>();
    for (const member of members) {
      const completed = (byUser.get(member.id) ?? []).filter(
        (t) => t.status.category === 'done' && t.completedAt && t.completedAt >= start && t.completedAt <= end,
      ).length;
      completedCounts.set(member.id, completed);
    }
    const maxCompleted = Math.max(1, ...completedCounts.values());

    const holidayCache = new Map<string, ReadonlySet<string>>();
    const result = new Map<string, Scorecard>();

    for (const member of members) {
      const regionKey = `${member.workCountry}::${member.workState}`;
      if (!holidayCache.has(regionKey)) {
        holidayCache.set(regionKey, await this.holidayCalendars.getHolidayDateKeys(member.workCountry, member.workState));
      }
      const holidays = holidayCache.get(regionKey)!;
      const memberTasks = byUser.get(member.id) ?? [];
      const completedCount = completedCounts.get(member.id) ?? 0;
      const reworkedCount = reworkCounts.get(member.id) ?? 0;

      // On-time rate: of tasks completed in-range that had a due date, what fraction weren't
      // business-day-overdue as of their completion.
      const completedWithDueDate = memberTasks.filter(
        (t) => t.status.category === 'done' && t.completedAt && t.completedAt >= start && t.completedAt <= end && t.dueDate,
      );
      const onTimeCount = completedWithDueDate.filter(
        (t) => !isOverdueOnBusinessDay(t.dueDate!, t.completedAt!, holidays),
      ).length;
      const onTimeRateScore = completedWithDueDate.length === 0 ? 100 : (100 * onTimeCount) / completedWithDueDate.length;

      // Estimate accuracy: of completed-in-range tasks with an estimate, how close logged
      // hours landed to the assignee's own estimate (§H2 — assignee-set, mandatory before start).
      const completedWithEstimate = memberTasks.filter(
        (t) =>
          t.status.category === 'done' &&
          t.completedAt &&
          t.completedAt >= start &&
          t.completedAt <= end &&
          t.estimateValue !== null &&
          t.estimateUnit !== null,
      );
      let estimateAccuracyScore = 100;
      let avgEstimateErrorPct: number | null = null;
      if (completedWithEstimate.length > 0) {
        const errors = completedWithEstimate.map((t) => {
          const estimateMinutes = t.estimateUnit === 'days' ? t.estimateValue! * 8 * 60 : t.estimateValue! * 60;
          const loggedMinutes = t.timeLogs.reduce((sum, l) => sum + l.minutes, 0);
          return estimateMinutes === 0 ? 0 : Math.abs(loggedMinutes - estimateMinutes) / estimateMinutes;
        });
        const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
        avgEstimateErrorPct = avgError * 100;
        estimateAccuracyScore = Math.max(0, 100 * (1 - Math.min(avgError, 1)));
      }

      // Volume: completions this period relative to this department's top performer in the
      // same period — never company-wide (§J).
      const volumeScore = (100 * completedCount) / maxCompleted;

      // Overdue / over-budget: judged against tasks that had a due date / estimate and were
      // either completed in-range or are still open as of `end` — i.e. everything whose
      // lateness or budget status could actually be assessed as of the period's close.
      const dueDateRelevant = memberTasks.filter(
        (t) => t.dueDate && (t.completedAt ? t.completedAt >= start && t.completedAt <= end : true),
      );
      const overdueCount = dueDateRelevant.filter((t) =>
        isOverdueOnBusinessDay(t.dueDate!, t.completedAt ?? end, holidays),
      ).length;
      const overdueScore = dueDateRelevant.length === 0 ? 100 : 100 * (1 - overdueCount / dueDateRelevant.length);

      const estimateRelevant = memberTasks.filter(
        (t) =>
          t.estimateValue !== null &&
          t.estimateUnit !== null &&
          (t.completedAt ? t.completedAt >= start && t.completedAt <= end : true),
      );
      const overBudgetCount = estimateRelevant.filter((t) => {
        const estimateMinutes = t.estimateUnit === 'days' ? t.estimateValue! * 8 * 60 : t.estimateValue! * 60;
        const loggedMinutes = t.timeLogs.reduce((sum, l) => sum + l.minutes, 0);
        return loggedMinutes > estimateMinutes;
      }).length;
      const overBudgetScore = estimateRelevant.length === 0 ? 100 : 100 * (1 - overBudgetCount / estimateRelevant.length);

      // Rework: reopened-from-done events in-range, as a share of this period's total closure
      // events (completions + reopens) — see computeReworkCounts below for how reopens are
      // detected (there's no dedicated "reopened" state; it's inferred from activity history).
      const reworkDenominator = completedCount + reworkedCount;
      const reworkScore = reworkDenominator === 0 ? 100 : 100 * (1 - reworkedCount / reworkDenominator);

      const subScores: ScorecardSubScores = {
        on_time_rate: round1(onTimeRateScore),
        estimate_accuracy: round1(estimateAccuracyScore),
        volume: round1(volumeScore),
        overdue: round1(overdueScore),
        over_budget: round1(overBudgetScore),
        rework: round1(reworkScore),
      };

      const overallScore = round1(
        subScores.on_time_rate * weights.on_time_rate +
          subScores.estimate_accuracy * weights.estimate_accuracy +
          subScores.volume * weights.volume +
          subScores.overdue * weights.overdue +
          subScores.over_budget * weights.over_budget +
          subScores.rework * weights.rework,
      );

      result.set(member.id, {
        user_id: member.id,
        department_id: departmentId,
        range_start: start.toISOString(),
        range_end: end.toISOString(),
        overall_score: overallScore,
        sub_scores: subScores,
        raw: {
          completed_count: completedCount,
          on_time_count: onTimeCount,
          overdue_count: overdueCount,
          over_budget_count: overBudgetCount,
          reworked_count: reworkedCount,
          avg_estimate_error_pct: avgEstimateErrorPct === null ? null : round1(avgEstimateErrorPct),
        },
      });
    }

    return result;
  }

  /**
   * A "reopen" has no dedicated workflow state — it's any status_changed activity entry
   * whose `from` status was done-category and whose `to` status isn't, attributed to the
   * task's *current* assignee (an approximation: historical assignee-at-the-time isn't
   * tracked, logged as a known simplification per docs/10-OPEN-DECISIONS.md §J).
   */
  private async computeReworkCounts(userIds: string[], start: Date, end: Date): Promise<Map<string, number>> {
    const statuses = await this.prisma.workflowStatus.findMany({ select: { id: true, category: true } });
    const categoryById = new Map(statuses.map((s) => [s.id, s.category]));

    const entries = await this.prisma.activityLogEntry.findMany({
      where: {
        action: 'status_changed',
        createdAt: { gte: start, lte: end },
        task: { assigneeId: { in: userIds }, deletedAt: null },
      },
      select: { metadata: true, task: { select: { assigneeId: true } } },
    });

    const counts = new Map<string, number>();
    for (const entry of entries) {
      const meta = entry.metadata as { from?: string; to?: string };
      const assigneeId = entry.task?.assigneeId;
      if (!assigneeId || !meta?.from || !meta?.to) continue;
      const fromCategory = categoryById.get(meta.from);
      const toCategory = categoryById.get(meta.to);
      if (fromCategory === 'done' && toCategory !== 'done') {
        counts.set(assigneeId, (counts.get(assigneeId) ?? 0) + 1);
      }
    }
    return counts;
  }

  async getUserScorecard(userId: string, departmentId: string, start: Date, end: Date): Promise<Scorecard | null> {
    const all = await this.computeDepartmentScorecards(departmentId, start, end);
    return all.get(userId) ?? null;
  }

  async getLeaderboard(departmentId: string, start: Date, end: Date): Promise<LeaderboardEntry[]> {
    const all = await this.computeDepartmentScorecards(departmentId, start, end);
    const members = await this.prisma.user.findMany({
      where: { id: { in: [...all.keys()] } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(members.map((m) => [m.id, m.fullName]));

    return [...all.values()]
      .sort((a, b) => b.overall_score - a.overall_score)
      .map((s, index) => ({
        user_id: s.user_id,
        full_name: nameById.get(s.user_id) ?? 'Unknown',
        overall_score: s.overall_score,
        rank: index + 1,
      }));
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

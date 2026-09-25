import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class TimerSweeperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TimerSweeperService.name);
  private timer?: ReturnType<typeof setInterval>;
  private readonly LOCK_KEY = 1_795_403_127;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>("RUN_INLINE_JOBS") === "false") {
      this.logger.log("Inline jobs disabled. Timer sweeper will not run in-process.");
      return;
    }
    const intervalMs = Number(this.config.get<string>("TIMER_SWEEPER_INTERVAL_MS") ?? 5 * 60 * 1_000);
    this.timer = setInterval(() => {
      this.runSweep().catch((err) =>
        this.logger.error("Timer sweep failed: " + (err instanceof Error ? err.message : err), err?.stack),
      );
    }, intervalMs);
    this.logger.log("Timer sweeper started (interval=" + intervalMs + "ms, max=" + this.maxSessionMinutes + "min)");
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private get maxSessionMinutes(): number {
    return Number(this.config.get<string>("MAX_TIMER_SESSION_MINUTES") ?? 600);
  }

  async runSweep(): Promise<{ stopped: number; errors: number }> {
    let acquired = false;
    try {
      const result = await this.prisma.$queryRaw<[{ acquired: boolean }]>`
        SELECT pg_try_advisory_lock(${this.LOCK_KEY}::bigint) AS acquired
      `;
      acquired = result[0]?.acquired ?? false;
      if (!acquired) {
        this.logger.debug("Timer sweep skipped — another instance holds the lock");
        return { stopped: 0, errors: 0 };
      }
      return await this.sweep();
    } finally {
      if (acquired) {
        await this.prisma.$queryRaw`SELECT pg_advisory_unlock(${this.LOCK_KEY}::bigint)`.catch(() => {});
      }
    }
  }

  private async sweep(): Promise<{ stopped: number; errors: number }> {
    const maxMs = this.maxSessionMinutes * 60 * 1_000;
    const cutoff = new Date(Date.now() - maxMs);
    let stopped = 0;
    let errors = 0;

    const runaway = await this.prisma.task.findMany({
      where: { timerStartedAt: { not: null, lt: cutoff }, deletedAt: null },
      include: { assignee: { select: { id: true, fullName: true, managerId: true } } },
    });

    for (const task of runaway) {
      try {
        const elapsedMs = Date.now() - task.timerStartedAt!.getTime();
        const cappedMinutes = this.maxSessionMinutes;

        await this.prisma.timeLog.create({
          data: {
            taskId: task.id,
            userId: task.assigneeId ?? task.id,
            minutes: cappedMinutes,
            note: "[Auto-stopped] Session exceeded " + this.maxSessionMinutes + "min limit. Elapsed: " + Math.round(elapsedMs / 60000) + "min (wall-clock). Only " + cappedMinutes + "min logged.",
            loggedAt: new Date(),
          },
        });

        const totalResult = await this.prisma.timeLog.aggregate({
          where: { taskId: task.id },
          _sum: { minutes: true },
        });
        const newTotal = totalResult._sum.minutes ?? cappedMinutes;

        await this.prisma.task.update({
          where: { id: task.id },
          data: { timerStartedAt: null, totalLoggedMinutes: newTotal },
        });

        await this.prisma.activityLogEntry.create({
          data: {
            taskId: task.id,
            actorId: null,
            action: "timer_auto_stopped",
            metadata: {
              reason: "max_session_exceeded",
              maxMinutes: this.maxSessionMinutes,
              elapsedMinutes: Math.round(elapsedMs / 60000),
              cappedMinutes,
            },
          },
        });

        if (task.assigneeId) {
          await this.notifications.notify(task.assigneeId, "timer_auto_stopped", {
            taskId: task.id,
            taskTitle: task.title,
            maxHours: Math.round(this.maxSessionMinutes / 60),
            loggedMinutes: cappedMinutes,
          }).catch(() => {});
        }

        if (task.assignee?.managerId) {
          await this.notifications.notify(task.assignee.managerId, "timer_auto_stopped", {
            taskId: task.id,
            taskTitle: task.title,
            assigneeName: task.assignee.fullName ?? "Team member",
            maxHours: Math.round(this.maxSessionMinutes / 60),
          }).catch(() => {});
        }

        stopped++;
        this.logger.warn("Auto-stopped runaway timer: task=" + task.id + " elapsed=" + Math.round(elapsedMs / 60000) + "min capped=" + cappedMinutes + "min");
      } catch (err) {
        errors++;
        this.logger.error("Failed to auto-stop timer for task " + task.id + ": " + (err instanceof Error ? err.message : err));
      }
    }

    if (stopped > 0 || runaway.length > 0) {
      this.logger.log("Timer sweep: checked=" + runaway.length + " stopped=" + stopped + " errors=" + errors);
    }

    return { stopped, errors };
  }
}

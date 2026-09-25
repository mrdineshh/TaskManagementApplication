import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    await this.ensureStandardTransitions();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async ensureStandardTransitions() {
    try {
      const workflows = await this.workflowDefinition.findMany({
        include: { statuses: true, transitions: true },
      });

      const standardPairs: [string, string][] = [
        ['todo', 'in_progress'],
        ['todo', 'in_review'],
        ['todo', 'done'],
        ['todo', 'on_hold'],
        ['todo', 'cancelled'],
        ['in_progress', 'done'],
        ['in_progress', 'in_review'],
        ['in_progress', 'on_hold'],
        ['in_progress', 'blocked'],
        ['in_progress', 'cancelled'],
        ['in_progress', 'todo'],
        ['in_review', 'done'],
        ['in_review', 'in_progress'],
        ['in_review', 'on_hold'],
        ['in_review', 'cancelled'],
        ['on_hold', 'in_progress'],
        ['on_hold', 'done'],
        ['on_hold', 'cancelled'],
        ['on_hold', 'todo'],
        ['blocked', 'in_progress'],
        ['blocked', 'done'],
        ['blocked', 'cancelled'],
        ['done', 'in_progress'],
        ['done', 'todo'],
        ['cancelled', 'in_progress'],
        ['cancelled', 'todo'],
      ];

      for (const wf of workflows) {
        const statusMap = new Map<string, string>();
        for (const s of wf.statuses) {
          statusMap.set(s.key, s.id);
        }

        for (const [fromKey, toKey] of standardPairs) {
          const fromId = statusMap.get(fromKey);
          const toId = statusMap.get(toKey);
          if (fromId && toId && fromId !== toId) {
            const exists = wf.transitions.some(
              (t) => t.fromStatusId === fromId && t.toStatusId === toId,
            );
            if (!exists) {
              await this.workflowTransition
                .upsert({
                  where: {
                    workflowId_fromStatusId_toStatusId: {
                      workflowId: wf.id,
                      fromStatusId: fromId,
                      toStatusId: toId,
                    },
                  },
                  update: {},
                  create: {
                    workflowId: wf.id,
                    fromStatusId: fromId,
                    toStatusId: toId,
                  },
                })
                .catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to ensure standard transitions: ${err}`);
    }
  }
}


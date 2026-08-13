import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { ScorecardsService } from './scorecards.service';
import { scorecardRangeQuerySchema, updateScorecardConfigSchema } from '@taskapp/shared-types';

/**
 * Employee scorecard + department leaderboard (docs/10-OPEN-DECISIONS.md §J). Viewing is
 * intentionally NOT department-scope-restricted like most resources — the user was explicit
 * that scorecards are visible to everyone ("the idea is to motivate everyone and create a
 * healthy competition... a transparent system"), gated only by `task.view` (every real role
 * holds it) rather than a dedicated view permission. Only the weighting config is Admin-only.
 */
@ApiTags('scorecards')
@Controller('scorecards')
export class ScorecardsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecards: ScorecardsService,
  ) {}

  @Get('config')
  @RequirePermission('task.view')
  async getConfig() {
    return this.scorecards.getConfig();
  }

  @Patch('config')
  @RequirePermission('scorecard.manage')
  async updateConfig(@Body() body: unknown) {
    const input = updateScorecardConfigSchema.parse(body);
    return this.scorecards.updateConfig(input.weights);
  }

  @Get('me')
  @RequirePermission('task.view')
  async me(@CurrentUser() user: AccessTokenPayload, @Query() query: Record<string, string>) {
    const { start, end } = scorecardRangeQuerySchema.parse(query);
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.sub } });
    return this.scorecards.getUserScorecard(me.id, me.primaryDepartmentId, new Date(start), new Date(end));
  }

  @Get('users/:userId')
  @RequirePermission('task.view')
  async forUser(@Param('userId') userId: string, @Query() query: Record<string, string>) {
    const { start, end } = scorecardRangeQuerySchema.parse(query);
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    const scorecard = await this.scorecards.getUserScorecard(target.id, target.primaryDepartmentId, new Date(start), new Date(end));
    if (!scorecard) throw new NotFoundException('No scorecard available for this user/range');
    return scorecard;
  }

  @Get('leaderboard')
  @RequirePermission('task.view')
  async leaderboard(@Query() query: Record<string, string>) {
    const { start, end } = scorecardRangeQuerySchema.parse(query);
    const departmentId = query.department_id;
    if (!departmentId) throw new BadRequestException('department_id is required');
    return this.scorecards.getLeaderboard(departmentId, new Date(start), new Date(end));
  }
}

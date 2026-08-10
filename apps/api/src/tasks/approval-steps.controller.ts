import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { DecideApprovalStepDto } from './dto/approval.dto';

@ApiTags('tasks')
@Controller('approval-steps')
export class ApprovalStepsController {
  constructor(private readonly tasks: TasksService) {}

  @Post(':id/decide')
  decide(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Body() dto: DecideApprovalStepDto) {
    // Permission (approval.approve) + department scope are checked inside the service —
    // same "no single @RequirePermission fits" reasoning as the task transition endpoint.
    return this.tasks.decideApprovalStep(user, id, dto.decision, dto.comment);
  }
}

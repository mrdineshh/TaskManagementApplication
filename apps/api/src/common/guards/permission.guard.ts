import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { AccessTokenPayload } from '../../auth/auth.service';

/**
 * Checks the caller's JWT-embedded permission set against the endpoint's
 * @RequirePermission() (docs/03-RBAC-AUTH.md §2.3). This confirms the user
 * holds the permission via *some* role; per-resource department scoping
 * (e.g. "does this task belong to a department the user has the role in")
 * is enforced separately, at the query layer, inside each module's service —
 * this guard alone can't inspect a not-yet-loaded resource.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AccessTokenPayload | undefined;
    if (!user) throw new ForbiddenException('Not authenticated');

    if (!user.permissions.includes(required)) {
      throw new ForbiddenException(`Missing required permission: ${required}`);
    }
    return true;
  }
}

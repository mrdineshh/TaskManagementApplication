import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Normalizes every JSON response to snake_case keys, matching the request-body and
 * query-param convention documented in docs/04-API-SPEC.md. Prisma returns camelCase
 * field names (e.g. `departmentId`); without this, responses would silently drift from
 * the documented contract that DTOs/shared-types validate against — a real problem
 * for a REST API meant to support third-party integrations (docs/00-OVERVIEW.md §5).
 *
 * Also converts BigInt (e.g. TaskAttachment.size_bytes) to Number, since
 * JSON.stringify throws on BigInt otherwise.
 */
@Injectable()
export class SnakeCaseResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => toSnakeCase(data)));
  }
}

function toSnakeCase(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(toSnakeCase);
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[camelToSnake(key)] = toSnakeCase(val);
    }
    return result;
  }
  return value;
}

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

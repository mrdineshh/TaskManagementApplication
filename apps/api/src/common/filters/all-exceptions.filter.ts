import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

/** Maps every thrown error onto the error envelope defined in docs/04-API-SPEC.md §1. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof ZodError) {
      // Several controllers validate their DTO by calling a shared-types zod schema's
      // .parse(body) directly (e.g. ScorecardsController, OrganizationController) rather than
      // going through Nest's class-validator ValidationPipe — an uncaught ZodError previously
      // fell through to the generic Error branch below and came back as a raw 500 with the
      // zod issue array dumped into `message` (docs/10-OPEN-DECISIONS.md §J4/§M1). Formatting
      // it here fixes every one of those call sites at once, not just the ones that prompted
      // this fix, without requiring each controller to wrap its own .parse() in a try/catch.
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = exception.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      details = { validation: exception.issues };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string) ?? exception.message;
        details = typeof b.message === 'object' ? { validation: b.message } : undefined;
      }
      code = defaultCodeForStatus(status);
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      message = exception.message;
    }

    response.status(status).json({ error: { code, message, details } });
  }
}

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE';
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
}

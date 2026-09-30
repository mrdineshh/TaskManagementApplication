import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  // Allows Cloud Run SIGTERM to drain in-flight requests and stop background
  // timers before the container exits.
  app.enableShutdownHooks();

  // ── Security headers (helmet equivalent via manual Express middleware) ────
  // Sets X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, etc.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // ── Request ID tracing ───────────────────────────────────────────────────
  // Generates a unique request ID for each request. Propagates from the
  // x-request-id header if the load balancer or client sends one.
  // Attaches x-instance-id using Cloud Run revision + hostname.
  const instanceId = `${process.env.K_REVISION ?? 'local'}/${process.env.HOSTNAME ?? 'dev'}`;
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-instance-id', instanceId);
    next();
  });

  // ── CORS ─────────────────────────────────────────────────────────────────
  // Strict allow-list from env; fall back to permissive in non-production so
  // localhost dev still works without requiring extra env setup.
  const corsOriginsRaw = process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN;
  const allowedOrigins = corsOriginsRaw && corsOriginsRaw !== '*'
    ? corsOriginsRaw.split(/[,|]/).map((o) => o.trim()).filter(Boolean)
    : null;
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile/Postman/server-to-server).
      if (!origin) return callback(null, true);
      if (!allowedOrigins) {
        // No allow-list configured — permissive (dev/staging without explicit list).
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'x-request-id'],
    exposedHeaders: ['x-request-id', 'x-instance-id'],
    credentials: true,
  });

  // ── Body size limits ─────────────────────────────────────────────────────
  // 10 MB for base64-encoded images; review attachments move to GCS later.
  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '10mb' }));

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'healthz', 'readyz'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Swagger ───────────────────────────────────────────────────────────────
  // Disabled in production to avoid leaking API internals.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Pulse API')
      .setDescription('REST API for Pulse')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[Pulse API] Listening on :${port} | instance=${instanceId} | env=${process.env.NODE_ENV ?? 'development'}`);
}
bootstrap();

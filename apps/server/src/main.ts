import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import { Logger } from 'nestjs-pino';
import { AppDataSource } from './database/data-source';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';
import { mountBetterAuth } from './modules/auth/better-auth.mount';

/**
 * Server entrypoint (§13.3): run idempotent migrations BEFORE booting the app (this includes
 * CREATE EXTENSION vector and the HNSW index). Then start the Fastify HTTP server under the
 * `/api` prefix that nginx routes to (§13.1).
 */
async function bootstrap(): Promise<void> {
  await AppDataSource.initialize();
  await AppDataSource.runMigrations();
  await AppDataSource.destroy();

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // Multipart for image/file uploads (§8.3). 25 MB cap.
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const config = loadConfig();

  // Better Auth (email+password, Google/Apple, admin + organization) serves /api/auth/* when
  // opted in. The default `legacy` path keeps the built-in JWT flow untouched.
  if (config.auth.provider === 'better-auth') {
    await mountBetterAuth(app.getHttpAdapter().getInstance());
  }

  await app.listen(config.port, '0.0.0.0');
}

void bootstrap();

/**
 * Main Application Entry Point
 * SUNAT Wrapper - Microservicio para integración con SUNAT Perú
 */

import Fastify, { FastifyInstance } from 'fastify';
import { loadConfig, getConfig } from '@/config';
import { registerRoutes } from '@/controllers';
import { SunatException } from '@/errors';

// Load configuration at startup
loadConfig();

const config = getConfig();

/**
 * Creates and configures the Fastify application
 */
async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: config.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss Z' },
      } : undefined,
    },
    ajv: {
      customOptions: {
        strict: true,
        allErrors: true,
        verbose: true,
      },
    },
  });

  // Security headers
  await app.register(import('@fastify/helmet'), {
    contentSecurityPolicy: false, // Disable for API
  });

  // Rate limiting
  await app.register(import('@fastify/rate-limit'), {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    allowList: ['127.0.0.1', '::1'],
    keyGenerator: (req) => req.ip,
  });

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    request.log.error(error, 'Unhandled error');

    // SunatException handling
    if (error instanceof SunatException) {
      const statusCode = error.isRetryable() ? 503 : 400;
      return reply.status(statusCode).send({
        success: false,
        error: {
          code: error.parsedError.code,
          message: error.message,
          category: error.parsedError.category,
          isRetryable: error.isRetryable(),
          isBlocking: error.isBlocking(),
        },
      });
    }

    // Validation errors (Zod/AJV)
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request payload',
          details: error.validation,
          isRetryable: false,
        },
      });
    }

    // Generic errors
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: config.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error.message,
        isRetryable: statusCode >= 500,
      },
    });
  });

  // 404 handler
  app.setNotFoundHandler(async (request, reply) => {
    return reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
        isRetryable: false,
      },
    });
  });

  // Request/Response logging
  app.addHook('onRequest', async (request) => {
    const startTime = Date.now();
    (request as any).startTime = startTime;
    request.log.info({ 
      method: request.method, 
      url: request.url,
      ip: request.ip,
    }, 'Incoming request');
  });

  app.addHook('onResponse', async (request, reply) => {
    const startTime = (request as any).startTime || Date.now();
    const responseTime = Date.now() - startTime;
    request.log.info({ 
      method: request.method, 
      url: request.url,
      statusCode: reply.statusCode,
      responseTime,
    }, 'Request completed');
  });

  // Register API routes
  await registerRoutes(app);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down...');
    try {
      await app.close();
      app.log.info('Server closed successfully');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return app;
}

/**
 * Starts the server
 */
async function start(): Promise<void> {
  try {
    const app = await createApp();
    
    await app.listen({ 
      port: config.PORT, 
      host: config.HOST 
    });

    app.log.info(`
╔══════════════════════════════════════════════════════════════╗
║                    SUNAT Wrapper v1.0.0                       ║
║              Microservicio Facturación Electrónica            ║
╠══════════════════════════════════════════════════════════════╣
║  Environment: ${config.NODE_ENV.padEnd(48)}║
║  SUNAT Env:   ${config.SUNAT_ENV.padEnd(48)}║
║  Server:      http://${config.HOST}:${config.PORT.toString().padEnd(46)}║
║  Health:      http://${config.HOST}:${config.PORT}/api/v1/health${' '.repeat(30)}║
║  Docs:        http://${config.HOST}:${config.PORT}/api/v1/comprobantes/codigos-error${' '.repeat(20)}║
╚══════════════════════════════════════════════════════════════╝
    `);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start if run directly
if (require.main === module) {
  start();
}

export { createApp, start };
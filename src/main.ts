import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import * as cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express/interfaces/nest-express-application.interface';
import * as compression from 'compression';
import { allowedOrigins } from './core/config/cors.options';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const port = configService.get<number>('PORT', 3000);
  const apiVersion = configService.get<string>('API_VERSION', 'v1');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  app.set('trust proxy', configService.get<number>('TRUST_PROXY_HOPS', 0));
  app.enableShutdownHooks();
  app.setGlobalPrefix(`api/${apiVersion}`);

  const config = new DocumentBuilder()
    .setTitle('AIHN Backend API')
    .setDescription(
      'Production-ready NestJS backend with JWT authentication, PostgreSQL, and Prisma ORM',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'AIHN API Docs',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: '.swagger-ui .topbar { display: none }',
  });
  app.enableCors({
    origin: allowedOrigins(
      configService.get<string>('CORS_ORIGINS'),
      nodeEnv === 'production',
    ),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.use(cookieParser());
  app.use(
    '/api/reference',
    apiReference({
      spec: {
        content: document,
      },
      theme: 'purple',
    }),
  );
  app.use(
    compression({
      level: 6,
      threshold: 1024,
    }),
  );
  await app.listen(port);

  logger.log(
    `Application is running on: http://localhost:${port}/api/${apiVersion}`,
  );
  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`Swagger UI: http://localhost:${port}/api/docs`);
  logger.log(`Scalar API Reference: http://localhost:${port}/api/reference`);
  logger.log(`Health check: http://localhost:${port}/api/${apiVersion}/health`);
}

bootstrap();

import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { BigIntSerializerInterceptor } from './common/bigint-serializer.interceptor';
import { loadRuntimeEnvironment, validateRuntimeEnvironment } from './common/runtime-env';

async function bootstrap() {
  loadRuntimeEnvironment();
  validateRuntimeEnvironment(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const host = process.env.API_HOST ?? '127.0.0.1';
  const port = Number(process.env.API_PORT ?? 4310);
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:1420').split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalInterceptors(new BigIntSerializerInterceptor());
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('FarmaCore Local API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);
  app.enableShutdownHooks();
  await app.listen(port, host);
}

void bootstrap();

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Movies API')
    .setDescription(
      'RESTful API that syncs movie data from TMDB and exposes endpoints for browsing, ' +
        'searching, rating and watchlisting movies.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const configService = app.get(ConfigService);
  warnOnDefaultSecrets(configService);
  const port = configService.getOrThrow<number>('app.port');
  await app.listen(port);
  Logger.log(`Application is running on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`API documentation available at http://localhost:${port}/docs`, 'Bootstrap');
}

function warnOnDefaultSecrets(configService: ConfigService): void {
  const usingDefaults = [
    configService.get<string>('auth.accessSecret'),
    configService.get<string>('auth.refreshSecret'),
  ].some((secret) => secret?.startsWith('change-me'));

  if (configService.get<string>('app.env') === 'production' && usingDefaults) {
    Logger.warn(
      'JWT secrets are using default values; set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET',
      'Bootstrap',
    );
  }
}

void bootstrap();

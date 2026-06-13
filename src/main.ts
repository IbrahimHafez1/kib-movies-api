import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Movies API')
    .setDescription(
      `RESTful API that syncs movie data from [TMDB](https://www.themoviedb.org/) and lets users browse, search, rate and watchlist movies.

## Authentication
Call **POST /auth/register** (or **/auth/login**) right from this page — the API sets an httpOnly \`access_token\` cookie and every protected endpoint works from then on. Non-browser clients can instead click **Authorize** and paste the \`accessToken\` returned by register/login as a Bearer token. Access tokens last 15 minutes; rotate them via **POST /auth/refresh**.

## Errors
Errors use a consistent envelope: \`{ "message": string | string[], "error": string, "statusCode": number }\`. Validation failures return **400** with one message per violated rule.

## Rate limits
100 requests/minute per client globally; 10 requests/minute on auth endpoints. Exceeding either returns **429**.`,
    )
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Paste the accessToken returned by /auth/register or /auth/login',
    })
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
      description: 'Set automatically by register/login; nothing to configure',
    })
    .addTag('movies', 'Browse, search, filter and sort the movie catalog')
    .addTag('genres', 'Movie genres synced from TMDB')
    .addTag('ratings', 'Rate movies 1-10; averages appear on every movie payload')
    .addTag('watchlist', "Manage the authenticated user's watchlist")
    .addTag('auth', 'Registration, login, token refresh and logout')
    .addTag('sync', 'On-demand TMDB synchronization')
    .addTag('health', 'Liveness and dependency checks')
    .addTag('root', 'Service metadata')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Movies API — Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 1,
      operationsSorter: 'alpha',
    },
  });

  const configService = app.get(ConfigService);
  assertSecretsConfigured(configService);
  const port = configService.getOrThrow<number>('app.port');
  await app.listen(port);
  Logger.log(`Application is running on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`API documentation available at http://localhost:${port}/docs`, 'Bootstrap');
}

function assertSecretsConfigured(configService: ConfigService): void {
  const usingDefaults = [
    configService.get<string>('auth.accessSecret'),
    configService.get<string>('auth.refreshSecret'),
  ].some((secret) => secret?.startsWith('change-me'));

  if (configService.get<string>('app.env') === 'production' && usingDefaults) {
    // Refuse to boot with predictable signing keys in production.
    throw new Error(
      'JWT secrets must be configured in production: set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET',
    );
  }
}

void bootstrap();

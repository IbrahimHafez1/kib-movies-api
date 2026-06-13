import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/**
 * Middleware and pipes shared by the real bootstrap and the e2e test app,
 * so tests exercise exactly what production runs.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.use(helmet());
  app.use(cookieParser());
  // Lock CORS to explicit origins (with cookies) when CORS_ORIGIN is set; otherwise
  // reflect any origin but never share credentials, so the zero-config demo still works.
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors(
    corsOrigin
      ? { origin: corsOrigin.split(',').map((origin) => origin.trim()), credentials: true }
      : { origin: true },
  );
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  return app;
}

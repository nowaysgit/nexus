import { registerAs } from '@nestjs/config';

/**
 * Общие настройки приложения
 */
const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  logLevel: process.env.LOG_LEVEL || 'info',
  sentryDsn: process.env.SENTRY_DSN,
}));

export default appConfig;

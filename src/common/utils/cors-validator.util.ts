/**
 * Утилита для валидации и парсинга CORS origins
 */

export interface CorsConfig {
  origin: string[];
  methods: string[];
  credentials: boolean;
  allowedHeaders: string[];
  exposedHeaders: string[];
  preflightContinue: boolean;
  optionsSuccessStatus: number;
  maxAge: number;
}

/**
 * Валидирует и парсит CORS_ORIGIN из переменной окружения
 * @param corsOriginEnv - значение переменной окружения CORS_ORIGIN
 * @returns массив валидных origins
 * @throws Error если переменная не задана или пуста
 */
export function validateAndParseCorsOrigins(corsOriginEnv?: string): string[] {
  if (!corsOriginEnv || corsOriginEnv.trim() === '') {
    throw new Error('CORS_ORIGIN environment variable is required');
  }

  const corsOrigins = corsOriginEnv
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  if (corsOrigins.length === 0) {
    throw new Error('CORS_ORIGIN must contain at least one valid origin');
  }

  return corsOrigins;
}

/**
 * Создает полную конфигурацию CORS с валидированными origins
 * @param corsOriginEnv - значение переменной окружения CORS_ORIGIN
 * @returns объект конфигурации CORS
 */
export function createCorsConfig(corsOriginEnv?: string): CorsConfig {
  const origins = validateAndParseCorsOrigins(corsOriginEnv);

  return {
    origin: origins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
    exposedHeaders: ['Content-Disposition'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 3600,
  };
}

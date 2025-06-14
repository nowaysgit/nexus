import * as Joi from 'joi';

/**
 * Схема валидации для переменных окружения
 * Позволяет проверить корректность всех переменных при запуске приложения
 */
export const validationSchema = Joi.object({
  // Основные настройки приложения
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .default('info'),
  SENTRY_DSN: Joi.string().optional(),

  // База данных
  DATABASE_HOST: Joi.string().default('localhost'),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USERNAME: Joi.string().default('postgres'),
  DATABASE_PASSWORD: Joi.string().default('postgres'),
  DATABASE_NAME: Joi.string().default('nexus'),
  DATABASE_SYNCHRONIZE: Joi.boolean().default(false),
  DATABASE_LOGGING: Joi.boolean().default(false),

  // OpenAI API
  OPENAI_API_KEY: Joi.string().required(),
  OPENAI_MODEL: Joi.string().default('gpt-4o'),
  OPENAI_DEFAULT_TEMPERATURE: Joi.number().min(0).max(2).default(0.7),
  OPENAI_MAX_RESPONSE_TOKENS: Joi.number().default(500),
  OPENAI_SYSTEM_TEMPERATURE: Joi.number().min(0).max(2).default(0.3),
  OPENAI_ANALYSIS_MODEL: Joi.string().default('gpt-4o'),

  // Telegram
  TELEGRAM_BOT_TOKEN: Joi.string().required(),
  TELEGRAM_WEBHOOK_URL: Joi.string().optional(),
  TELEGRAM_ADMIN_IDS: Joi.string().optional(),
  TELEGRAM_MAX_MESSAGE_LENGTH: Joi.number().default(4096),
  TELEGRAM_RESPONSE_TIMEOUT: Joi.number().default(10000),

  // Настройки персонажей
  CHARACTER_BEHAVIOR_CYCLE_INTERVAL: Joi.number().default(5 * 60 * 1000),
  CHARACTER_NEEDS_UPDATE_INTERVAL: Joi.number().default(60 * 1000),
  CHARACTER_MOTIVATION_CHECK_INTERVAL: Joi.number().default(10 * 60 * 1000),
  CHARACTER_NEEDS_DEFAULT_GROWTH_RATE: Joi.number().default(5),
  CHARACTER_NEEDS_MAX_VALUE: Joi.number().default(100),
  CHARACTER_MOTIVATION_THRESHOLD: Joi.number().default(70),
  CHARACTER_ACTION_CHANCE: Joi.number().min(0).max(1).default(0.4),
  CHARACTER_DEFAULT_ACTION_DURATION: Joi.number().default(30 * 60 * 1000),
  CHARACTER_PROACTIVE_MESSAGE_INTERVAL: Joi.number().default(6 * 60 * 60 * 1000),
  CHARACTER_MAX_MEMORY_COUNT: Joi.number().default(100),
  CHARACTER_DEFAULT_MEMORY_IMPORTANCE: Joi.number().min(1).max(10).default(5),
  CHARACTER_MEMORY_RETENTION_TIME: Joi.number().default(30 * 24 * 60 * 60 * 1000),
  CHARACTER_DEFAULT_ARCHETYPE: Joi.string().default('gentle'),
  CHARACTER_DEFAULT_AGE_MIN: Joi.number().default(25),
  CHARACTER_DEFAULT_AGE_MAX: Joi.number().default(35),
});

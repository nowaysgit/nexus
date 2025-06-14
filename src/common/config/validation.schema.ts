import * as Joi from 'joi';

/**
 * Объединенная схема валидации для переменных окружения
 * Включает валидацию для всех модулей: app, jwt, database, logging, openai, telegram, character, monitoring
 */
export const validationSchema = Joi.object({
  // Основные настройки приложения
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .default('info'),
  APP_ENCRYPTION_KEY: Joi.string().min(32).optional(),

  // JWT настройки
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),

  // База данных
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.string().default('password'),
  DB_NAME: Joi.string().default('nexus'),
  DB_LOGGING: Joi.boolean().default(false),
  DB_SSL: Joi.boolean().default(false),
  DB_MAX_CONNECTIONS: Joi.number().default(10),
  DB_IDLE_TIMEOUT: Joi.number().default(30000),
  DB_CONNECTION_TIMEOUT: Joi.number().default(2000),

  // Логирование
  LOG_FORMAT: Joi.string().valid('json', 'simple').default('json'),
  LOG_FILE_ENABLED: Joi.boolean().default(false),
  LOG_FILE_NAME: Joi.string().default('app.log'),
  LOG_FILE_MAX_SIZE: Joi.number().default(10485760),
  LOG_FILE_MAX_FILES: Joi.number().default(5),
  LOG_CONSOLE_ENABLED: Joi.boolean().default(true),
  LOG_CONSOLE_COLORIZE: Joi.boolean().default(false),
  LOG_STORAGE_ENABLED: Joi.boolean().default(true),
  LOG_STORAGE_DIR: Joi.string().default('storage'),
  LOG_USE_ASYNC_LOCAL_STORAGE: Joi.boolean().default(false),
  LOG_FILTER_DEFAULT_LEVEL: Joi.string().default('info'),

  // Rollbar
  ROLLBAR_ENABLED: Joi.boolean().default(false),
  ROLLBAR_ACCESS_TOKEN: Joi.string().when('ROLLBAR_ENABLED', {
    is: true,
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),

  // OpenAI API
  OPENAI_API_KEY: Joi.string().required(),
  OPENAI_ORGANIZATION: Joi.string().optional(),
  OPENAI_MODEL: Joi.string().default('gpt-3.5-turbo'),
  OPENAI_MAX_TOKENS: Joi.number().default(1000),
  OPENAI_TEMPERATURE: Joi.number().min(0).max(2).default(0.7),
  OPENAI_TIMEOUT: Joi.number().default(30000),
  OPENAI_RETRIES: Joi.number().default(3),
  OPENAI_CACHE_ENABLED: Joi.boolean().default(false),
  OPENAI_CACHE_TTL: Joi.number().default(3600),
  OPENAI_BUDGET_ENABLED: Joi.boolean().default(false),
  OPENAI_DAILY_LIMIT: Joi.number().default(10.0),
  OPENAI_MONTHLY_LIMIT: Joi.number().default(100.0),
  OPENAI_ALERT_THRESHOLD: Joi.number().default(0.8),
  OPENAI_MONITORING_ENABLED: Joi.boolean().default(false),
  OPENAI_METRICS_RETENTION: Joi.number().default(7),

  // Telegram
  TELEGRAM_BOT_TOKEN: Joi.string().required(),
  TELEGRAM_WEBHOOK_URL: Joi.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: Joi.string().optional(),
  TELEGRAM_POLLING: Joi.boolean().default(false),
  TELEGRAM_TIMEOUT: Joi.number().default(30000),
  TELEGRAM_RETRIES: Joi.number().default(3),
  TELEGRAM_ADMIN_CHAT_ID: Joi.string().optional(),
  TELEGRAM_ALLOWED_USERS: Joi.string().optional(),
  TELEGRAM_RATE_LIMIT_ENABLED: Joi.boolean().default(false),
  TELEGRAM_RATE_LIMIT_MAX_REQUESTS: Joi.number().default(30),
  TELEGRAM_RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  TELEGRAM_FEATURE_CHARACTER_INTERACTION: Joi.boolean().default(true),
  TELEGRAM_FEATURE_STORY_MODE: Joi.boolean().default(false),
  TELEGRAM_FEATURE_ADMIN_COMMANDS: Joi.boolean().default(false),

  // Персонажи
  CHARACTER_DEFAULT_PERSONALITY: Joi.string().default('friendly'),
  CHARACTER_MAX_MEMORY_SIZE: Joi.number().default(100),
  CHARACTER_RESPONSE_TIMEOUT: Joi.number().default(30000),
  CHARACTER_EMOTIONAL_RANGE_MIN: Joi.number().default(-1.0),
  CHARACTER_EMOTIONAL_RANGE_MAX: Joi.number().default(1.0),
  CHARACTER_ADAPTATION_RATE: Joi.number().default(0.1),
  CHARACTER_MEMORY_DECAY_RATE: Joi.number().default(0.01),
  CHARACTER_RESPONSE_VARIABILITY: Joi.number().default(0.3),
  CHARACTER_GENERATION_ENABLED: Joi.boolean().default(false),
  CHARACTER_MAX_CHARACTERS: Joi.number().default(10),
  CHARACTER_AUTO_GENERATE: Joi.boolean().default(false),

  // Мониторинг
  MONITORING_ENABLED: Joi.boolean().default(false),
  MONITORING_PORT: Joi.number().default(9090),
  MONITORING_PATH: Joi.string().default('/metrics'),
  PROMETHEUS_ENABLED: Joi.boolean().default(false),
  PROMETHEUS_ENDPOINT: Joi.string().default('http://localhost:9090'),
  PROMETHEUS_PUSH_GATEWAY: Joi.string().optional(),
  GRAFANA_ENABLED: Joi.boolean().default(false),
  GRAFANA_URL: Joi.string().default('http://localhost:3001'),
  GRAFANA_API_KEY: Joi.string().optional(),

  // Алерты
  ALERTS_ENABLED: Joi.boolean().default(false),
  SLACK_ALERTS_ENABLED: Joi.boolean().default(false),
  SLACK_WEBHOOK_URL: Joi.string().optional(),
  SLACK_CHANNEL: Joi.string().default('#alerts'),
  PAGERDUTY_ENABLED: Joi.boolean().default(false),
  PAGERDUTY_INTEGRATION_KEY: Joi.string().optional(),
  EMAIL_ALERTS_ENABLED: Joi.boolean().default(false),
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),
  EMAIL_FROM: Joi.string().optional(),
  EMAIL_TO: Joi.string().optional(),

  // Пороги мониторинга
  THRESHOLD_CPU: Joi.number().default(80),
  THRESHOLD_MEMORY: Joi.number().default(80),
  THRESHOLD_DISK: Joi.number().default(90),
  THRESHOLD_RESPONSE_TIME: Joi.number().default(1000),
  THRESHOLD_ERROR_RATE: Joi.number().default(5),

  // Автомасштабирование
  AUTO_SCALING_ENABLED: Joi.boolean().default(false),
  K8S_SCALING_ENABLED: Joi.boolean().default(false),
  K8S_NAMESPACE: Joi.string().default('default'),
  K8S_DEPLOYMENT: Joi.string().default('nexus-app'),
  K8S_MIN_REPLICAS: Joi.number().default(1),
  K8S_MAX_REPLICAS: Joi.number().default(10),
  K8S_TARGET_CPU: Joi.number().default(70),
  K8S_TARGET_MEMORY: Joi.number().default(70),

  // Оптимизация БД
  DB_OPTIMIZATION_ENABLED: Joi.boolean().default(false),
  DB_AUTO_VACUUM: Joi.boolean().default(false),
  DB_INDEX_ANALYSIS: Joi.boolean().default(false),
  DB_QUERY_OPTIMIZATION: Joi.boolean().default(false),
  DB_MONITORING_ENABLED: Joi.boolean().default(false),
  DB_SLOW_QUERY_THRESHOLD: Joi.number().default(1000),
  DB_CONNECTION_POOL_MONITORING: Joi.boolean().default(false),

  // Админ
  ADMIN_API_KEY: Joi.string().default('default-admin-key-please-change-in-production'),
});

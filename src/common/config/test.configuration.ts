/**
 * Конфигурация для тестового окружения
 * Переопределяет основные настройки для тестов
 */
export default () => ({
  app: {
    env: 'test',
    port: parseInt(process.env.TEST_PORT || '3001', 10),
    logLevel: process.env.TEST_LOG_LEVEL || 'error',
    encryptionKey: process.env.TEST_ENCRYPTION_KEY || 'test-encryption-key-32-chars-long',
  },

  database: {
    type: 'postgres' as const,
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
    username: process.env.TEST_DB_USERNAME || 'nexus_test',
    password: process.env.TEST_DB_PASSWORD || 'test_password',
    database: process.env.TEST_DB_NAME || 'nexus_test',
    synchronize: true, // В тестах всегда синхронизируем схему
    logging: process.env.TEST_DB_LOGGING === 'true',
    dropSchema: true, // Очищаем схему перед каждым запуском тестов
    entities: ['src/**/*.entity{.ts,.js}'],
    migrations: [],
    ssl: false,
    extra: {
      max: 5, // Меньше соединений для тестов
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    },
  },

  logging: {
    level: 'error', // Минимальное логирование в тестах
    format: 'simple',
    file: {
      enabled: false, // Отключаем файловое логирование в тестах
    },
    console: {
      enabled: process.env.TEST_LOG_CONSOLE !== 'false',
      colorize: false,
    },
    rollbar: {
      enabled: false, // Отключаем Rollbar в тестах
    },
    storage: {
      enabled: false, // Отключаем хранение логов в тестах
    },
    useAsyncLocalStorage: false,
    filter: {
      defaultLevel: 'error',
      contextLevels: {},
      disabledContexts: ['TypeOrmModule', 'InstanceLoader', 'RoutesResolver'],
      includePatterns: [],
      excludePatterns: ['health', 'metrics'],
    },
  },

  llm: {
    activeProvider: 'llama', // Используем Llama в тестах
    fallbackEnabled: false, // Отключаем fallback в тестах
    retryAttempts: 1, // Меньше попыток в тестах
    timeout: 5000, // Короткий таймаут для тестов
    cache: {
      enabled: false, // Отключаем кэш в тестах для предсказуемости
      ttl: 60,
    },
    providers: {
      openai: {
        enabled: false, // Отключаем OpenAI в тестах
        priority: 2,
      },
      llama: {
        enabled: true,
        priority: 1,
        endpoint: process.env.TEST_LLAMA_ENDPOINT || 'http://localhost:8080',
        apiKey: process.env.TEST_LLAMA_API_KEY || 'test-api-key',
        model: process.env.TEST_LLAMA_MODEL || 'llama-4-test',
      },
    },
    monitoring: {
      enabled: false, // Отключаем мониторинг в тестах
    },
  },

  telegram: {
    botToken: process.env.TEST_TELEGRAM_BOT_TOKEN || 'test-bot-token',
    webhookUrl: '',
    webhookSecret: '',
    polling: false, // Отключаем polling в тестах
    timeout: 5000,
    retries: 1,
    adminChatId: process.env.TEST_TELEGRAM_ADMIN_CHAT_ID || '123456789',
    allowedUsers: ['123456789'],
    rateLimit: {
      enabled: false, // Отключаем rate limiting в тестах
    },
    features: {
      characterInteraction: true,
      storyMode: false,
      adminCommands: false,
    },
  },

  character: {
    defaultPersonality: 'test',
    maxMemorySize: 10, // Меньше памяти в тестах
    responseTimeout: 5000,
    emotionalRange: {
      min: -1.0,
      max: 1.0,
    },
    behavior: {
      adaptationRate: 0.1,
      memoryDecayRate: 0.01,
      responseVariability: 0.0, // Отключаем вариативность в тестах
    },
    generation: {
      enabled: false, // Отключаем автогенерацию в тестах
      maxCharacters: 3,
      autoGenerate: false,
    },
  },

  monitoring: {
    enabled: false, // Отключаем мониторинг в тестах
    port: 9091,
    prometheus: {
      enabled: false,
    },
    grafana: {
      enabled: false,
    },
    alerts: {
      enabled: false,
    },
  },

  // Дополнительные настройки для тестов
  test: {
    // Настройки специфичные для тестов
    mockExternalServices: process.env.TEST_MOCK_EXTERNAL !== 'false',
    seedDatabase: process.env.TEST_SEED_DB === 'true',
    parallelTests: process.env.TEST_PARALLEL !== 'false',
    testTimeout: parseInt(process.env.TEST_TIMEOUT || '30000', 10),

    // Настройки для фикстур
    fixtures: {
      autoLoad: process.env.TEST_AUTO_LOAD_FIXTURES === 'true',
      path: process.env.TEST_FIXTURES_PATH || 'test/fixtures',
    },

    // Настройки для моков
    mocks: {
      llmResponses: process.env.TEST_MOCK_LLM === 'true',
      telegramApi: process.env.TEST_MOCK_TELEGRAM === 'true',
      externalApis: process.env.TEST_MOCK_EXTERNAL_APIS === 'true',
    },
  },
});

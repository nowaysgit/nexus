/**
 * Объединенная конфигурация приложения
 * Включает все настройки: app, jwt, database, logging, openai, telegram, character, monitoring
 */
export default () => ({
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
    encryptionKey: process.env.APP_ENCRYPTION_KEY || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  database: {
    type: 'postgres' as const,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'nexus',
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.DB_LOGGING === 'true',
    entities: ['dist/**/*.entity{.ts,.js}'],
    migrations: ['dist/migrations/*{.ts,.js}'],
    migrationsTableName: 'migrations',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    extra: {
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
    },
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    file: {
      enabled: process.env.LOG_FILE_ENABLED === 'true',
      filename: process.env.LOG_FILE_NAME || 'app.log',
      maxsize: parseInt(process.env.LOG_FILE_MAX_SIZE || '10485760', 10),
      maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '5', 10),
    },
    console: {
      enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
      colorize: process.env.LOG_CONSOLE_COLORIZE === 'true',
    },
    rollbar: {
      enabled: process.env.ROLLBAR_ENABLED === 'true',
      accessToken: process.env.ROLLBAR_ACCESS_TOKEN || '',
      environment: process.env.NODE_ENV || 'development',
      captureUncaught: true,
      captureUnhandledRejections: true,
    },
    storage: {
      enabled: process.env.LOG_STORAGE_ENABLED !== 'false',
      dir: process.env.LOG_STORAGE_DIR || 'storage',
    },
    useAsyncLocalStorage: process.env.LOG_USE_ASYNC_LOCAL_STORAGE === 'true',
    filter: {
      defaultLevel: process.env.LOG_FILTER_DEFAULT_LEVEL || 'info',
      contextLevels: {},
      disabledContexts: [],
      includePatterns: [],
      excludePatterns: [],
    },
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    organization: process.env.OPENAI_ORGANIZATION || '',
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000', 10),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000', 10),
    retries: parseInt(process.env.OPENAI_RETRIES || '3', 10),
    cache: {
      enabled: process.env.OPENAI_CACHE_ENABLED === 'true',
      ttl: parseInt(process.env.OPENAI_CACHE_TTL || '3600', 10),
    },
    budget: {
      enabled: process.env.OPENAI_BUDGET_ENABLED === 'true',
      dailyLimit: parseFloat(process.env.OPENAI_DAILY_LIMIT || '10.0'),
      monthlyLimit: parseFloat(process.env.OPENAI_MONTHLY_LIMIT || '100.0'),
      alertThreshold: parseFloat(process.env.OPENAI_ALERT_THRESHOLD || '0.8'),
    },
    monitoring: {
      enabled: process.env.OPENAI_MONITORING_ENABLED === 'true',
      metricsRetention: parseInt(process.env.OPENAI_METRICS_RETENTION || '7', 10),
    },
  },

  llm: {
    activeProvider: process.env.LLM_ACTIVE_PROVIDER || 'llama',
    fallbackEnabled: process.env.LLM_FALLBACK_ENABLED === 'true',
    retryAttempts: parseInt(process.env.LLM_RETRY_ATTEMPTS || '3', 10),
    timeout: parseInt(process.env.LLM_TIMEOUT || '30000', 10),
    cache: {
      enabled: process.env.LLM_CACHE_ENABLED === 'true',
      ttl: parseInt(process.env.LLM_CACHE_TTL || '3600', 10),
    },
    providers: {
      openai: {
        enabled: process.env.LLM_OPENAI_ENABLED !== 'false',
        priority: parseInt(process.env.LLM_OPENAI_PRIORITY || '1', 10),
      },
      llama: {
        enabled: process.env.LLM_LLAMA_ENABLED !== 'false',
        priority: parseInt(process.env.LLM_LLAMA_PRIORITY || '2', 10),
        endpoint: process.env.LLM_LLAMA_ENDPOINT || 'http://localhost:11434',
        apiKey: process.env.LLM_LLAMA_API_KEY || '',
        model: process.env.LLM_LLAMA_MODEL || 'llama3.2:3b',
        timeout: parseInt(process.env.LLM_LLAMA_TIMEOUT || '60000', 10),
      },
      claude: {
        enabled: process.env.LLM_CLAUDE_ENABLED === 'true',
        priority: parseInt(process.env.LLM_CLAUDE_PRIORITY || '3', 10),
        apiKey: process.env.LLM_CLAUDE_API_KEY || '',
        model: process.env.LLM_CLAUDE_MODEL || 'claude-3',
      },
      gemini: {
        enabled: process.env.LLM_GEMINI_ENABLED === 'true',
        priority: parseInt(process.env.LLM_GEMINI_PRIORITY || '4', 10),
        apiKey: process.env.LLM_GEMINI_API_KEY || '',
        model: process.env.LLM_GEMINI_MODEL || 'gemini-pro',
      },
    },
    monitoring: {
      enabled: process.env.LLM_MONITORING_ENABLED !== 'false',
      metrics: {
        responseTime: process.env.LLM_METRICS_RESPONSE_TIME === 'true',
        tokenUsage: process.env.LLM_METRICS_TOKEN_USAGE === 'true',
        errorRates: process.env.LLM_METRICS_ERROR_RATES === 'true',
        costs: process.env.LLM_METRICS_COSTS === 'true',
      },
    },
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    polling: process.env.TELEGRAM_POLLING === 'true',
    timeout: parseInt(process.env.TELEGRAM_TIMEOUT || '30000', 10),
    retries: parseInt(process.env.TELEGRAM_RETRIES || '3', 10),
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || '',
    allowedUsers: process.env.TELEGRAM_ALLOWED_USERS?.split(',') || [],
    rateLimit: {
      enabled: process.env.TELEGRAM_RATE_LIMIT_ENABLED === 'true',
      maxRequests: parseInt(process.env.TELEGRAM_RATE_LIMIT_MAX_REQUESTS || '30', 10),
      windowMs: parseInt(process.env.TELEGRAM_RATE_LIMIT_WINDOW_MS || '60000', 10),
    },
    features: {
      characterInteraction: process.env.TELEGRAM_FEATURE_CHARACTER_INTERACTION !== 'false',
      storyMode: process.env.TELEGRAM_FEATURE_STORY_MODE === 'true',
      adminCommands: process.env.TELEGRAM_FEATURE_ADMIN_COMMANDS === 'true',
    },
  },

  character: {
    defaultPersonality: process.env.CHARACTER_DEFAULT_PERSONALITY || 'friendly',
    maxMemorySize: parseInt(process.env.CHARACTER_MAX_MEMORY_SIZE || '100', 10),
    responseTimeout: parseInt(process.env.CHARACTER_RESPONSE_TIMEOUT || '30000', 10),
    emotionalRange: {
      min: parseFloat(process.env.CHARACTER_EMOTIONAL_RANGE_MIN || '-1.0'),
      max: parseFloat(process.env.CHARACTER_EMOTIONAL_RANGE_MAX || '1.0'),
    },
    behavior: {
      adaptationRate: parseFloat(process.env.CHARACTER_ADAPTATION_RATE || '0.1'),
      memoryDecayRate: parseFloat(process.env.CHARACTER_MEMORY_DECAY_RATE || '0.01'),
      responseVariability: parseFloat(process.env.CHARACTER_RESPONSE_VARIABILITY || '0.3'),
    },
    generation: {
      enabled: process.env.CHARACTER_GENERATION_ENABLED === 'true',
      maxCharacters: parseInt(process.env.CHARACTER_MAX_CHARACTERS || '10', 10),
      autoGenerate: process.env.CHARACTER_AUTO_GENERATE === 'true',
    },
  },

  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    port: parseInt(process.env.MONITORING_PORT || '9090', 10),
    path: process.env.MONITORING_PATH || '/metrics',
    prometheus: {
      enabled: process.env.PROMETHEUS_ENABLED === 'true',
      endpoint: process.env.PROMETHEUS_ENDPOINT || 'http://localhost:9090',
      pushGateway: process.env.PROMETHEUS_PUSH_GATEWAY || '',
    },
    grafana: {
      enabled: process.env.GRAFANA_ENABLED === 'true',
      url: process.env.GRAFANA_URL || 'http://localhost:3001',
      apiKey: process.env.GRAFANA_API_KEY || '',
    },
    alerts: {
      enabled: process.env.ALERTS_ENABLED === 'true',
      slack: {
        enabled: process.env.SLACK_ALERTS_ENABLED === 'true',
        webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        channel: process.env.SLACK_CHANNEL || '#alerts',
      },
      pagerduty: {
        enabled: process.env.PAGERDUTY_ENABLED === 'true',
        integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY || '',
      },
      email: {
        enabled: process.env.EMAIL_ALERTS_ENABLED === 'true',
        smtp: {
          host: process.env.SMTP_HOST || '',
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
          },
        },
        from: process.env.EMAIL_FROM || '',
        to: process.env.EMAIL_TO?.split(',') || [],
      },
    },
    thresholds: {
      cpu: parseFloat(process.env.THRESHOLD_CPU || '80'),
      memory: parseFloat(process.env.THRESHOLD_MEMORY || '80'),
      disk: parseFloat(process.env.THRESHOLD_DISK || '90'),
      responseTime: parseInt(process.env.THRESHOLD_RESPONSE_TIME || '1000', 10),
      errorRate: parseFloat(process.env.THRESHOLD_ERROR_RATE || '5'),
    },
    scaling: {
      enabled: process.env.AUTO_SCALING_ENABLED === 'true',
      kubernetes: {
        enabled: process.env.K8S_SCALING_ENABLED === 'true',
        namespace: process.env.K8S_NAMESPACE || 'default',
        deployment: process.env.K8S_DEPLOYMENT || 'nexus-app',
        minReplicas: parseInt(process.env.K8S_MIN_REPLICAS || '1', 10),
        maxReplicas: parseInt(process.env.K8S_MAX_REPLICAS || '10', 10),
        targetCPU: parseInt(process.env.K8S_TARGET_CPU || '70', 10),
        targetMemory: parseInt(process.env.K8S_TARGET_MEMORY || '70', 10),
      },
    },
    database: {
      optimization: {
        enabled: process.env.DB_OPTIMIZATION_ENABLED === 'true',
        autoVacuum: process.env.DB_AUTO_VACUUM === 'true',
        indexAnalysis: process.env.DB_INDEX_ANALYSIS === 'true',
        queryOptimization: process.env.DB_QUERY_OPTIMIZATION === 'true',
      },
      monitoring: {
        enabled: process.env.DB_MONITORING_ENABLED === 'true',
        slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000', 10),
        connectionPoolMonitoring: process.env.DB_CONNECTION_POOL_MONITORING === 'true',
      },
    },
  },

  admin: {
    apiKey: process.env.ADMIN_API_KEY || 'default-admin-key-please-change-in-production',
  },
});

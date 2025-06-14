/**
 * Интерфейс для базового модуля системы
 * Определяет общую структуру и функциональность модулей
 */
export interface Module {
  /**
   * Уникальный идентификатор модуля
   */
  readonly id?: string;

  /**
   * Название модуля
   */
  readonly name?: string;
}

/**
 * Интерфейс для модуля Telegram
 */
export interface ITelegramModule extends Module {
  /**
   * Токен для Telegram бота
   */
  readonly botToken?: string;

  /**
   * Настройки для Telegram
   */
  readonly settings?: {
    webhookEnabled?: boolean;
    webhookUrl?: string;
    pollingEnabled?: boolean;
  };
}

/**
 * Интерфейс для модуля диалогов
 */
export interface IDialogModule extends Module {
  /**
   * Максимальное количество сообщений в истории диалога
   */
  readonly maxHistorySize?: number;

  /**
   * Настройки для работы с диалогами
   */
  readonly settings?: {
    compressionEnabled?: boolean;
    analyticsEnabled?: boolean;
    cachingEnabled?: boolean;
  };
}

/**
 * Интерфейс для модуля пользователей
 */
export interface IUserModule extends Module {
  /**
   * Настройки для работы с пользователями
   */
  readonly settings?: {
    authEnabled?: boolean;
    cachingEnabled?: boolean;
    cacheTTL?: number;
  };
}

/**
 * Интерфейс для модуля персонажей
 */
export interface ICharacterModule extends Module {
  /**
   * Настройки для работы с персонажами
   */
  readonly settings?: {
    behaviorEnabled?: boolean;
    emotionsEnabled?: boolean;
    memoriesEnabled?: boolean;
    needsEnabled?: boolean;
  };
}

/**
 * Интерфейс для модуля логирования
 */
export interface ILoggingModule extends Module {
  /**
   * Уровень логирования
   */
  readonly logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'verbose';

  /**
   * Настройки для логирования
   */
  readonly settings?: {
    fileLoggingEnabled?: boolean;
    consoleLoggingEnabled?: boolean;
    logRotationEnabled?: boolean;
    maxLogSize?: number;
    maxLogFiles?: number;
  };
}

/**
 * Интерфейс для модуля аналитики
 */
export interface IAnalyticsModule extends Module {
  /**
   * Настройки для аналитики
   */
  readonly settings?: {
    trackingEnabled?: boolean;
    metricTypes?: string[];
    reportingInterval?: number;
  };
}

/**
 * Интерфейс для модуля мониторинга
 */
export interface IMonitoringModule extends Module {
  /**
   * Настройки для мониторинга
   */
  readonly settings?: {
    healthCheckEnabled?: boolean;
    performanceMetricsEnabled?: boolean;
    alertingEnabled?: boolean;
    checkInterval?: number;
  };
}

/**
 * Интерфейс для модуля историй
 */
export interface IStoryModule extends Module {
  /**
   * Настройки для работы с историями
   */
  readonly settings?: {
    autosaveEnabled?: boolean;
    branchingEnabled?: boolean;
    generationEnabled?: boolean;
  };
}

/**
 * Интерфейс для модуля базы данных
 */
export interface IDatabaseModule extends Module {
  /**
   * Настройки для работы с базой данных
   */
  readonly settings?: {
    connectionPoolSize?: number;
    retryAttempts?: number;
    retryDelay?: number;
    migrationEnabled?: boolean;
  };
}

/**
 * Интерфейс для модуля кэширования
 */
export interface ICacheModule extends Module {
  /**
   * Настройки для работы с кэшем
   */
  readonly settings?: {
    ttl?: number;
    maxItems?: number;
    checkPeriod?: number;
  };
}

/**
 * Интерфейс для модуля обработки ошибок
 */
export interface IErrorHandlingModule extends Module {
  /**
   * Настройки для обработки ошибок
   */
  readonly settings?: {
    detailedErrorsEnabled?: boolean;
    loggingEnabled?: boolean;
    retryEnabled?: boolean;
    alertingEnabled?: boolean;
  };
}

/**
 * Интерфейс для модуля валидации
 */
export interface IValidationModule extends Module {
  /**
   * Настройки для валидации
   */
  readonly settings?: {
    automaticValidationEnabled?: boolean;
    strictMode?: boolean;
    customValidatorsEnabled?: boolean;
  };
}

/**
 * Интерфейс для модуля HTTP клиента
 */
export interface IHttpClientModule extends Module {
  /**
   * Настройки для HTTP клиента
   */
  readonly settings?: {
    timeout?: number;
    retryEnabled?: boolean;
    maxRetries?: number;
    cacheEnabled?: boolean;
  };
}

/**
 * Интерфейс для корневого модуля приложения
 */
export interface IAppModule extends Module {
  /**
   * Настройки для приложения
   */
  readonly settings?: {
    port?: number;
    environment?: 'development' | 'production' | 'test';
    corsEnabled?: boolean;
    compressionEnabled?: boolean;
    rateLimit?: {
      enabled: boolean;
      max: number;
      timeWindow: number;
    };
  };
}

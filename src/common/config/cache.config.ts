import { registerAs } from '@nestjs/config';
import { CacheOptions, CacheType } from '../../cache/cache.interface';

export interface CacheEnvironmentConfig {
  // Общие настройки
  defaultTtl: number;
  enableDetailedStats: boolean;

  // Redis настройки
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  redisDb: number;

  // Настройки для автоматической очистки кэша
  autoCleanupThreshold: number;
  autoCleanupInterval: string;

  // Настройки для предварительного прогрева кэша
  enablePrewarm: boolean;
  prewarmInterval: string;
}

export interface CacheConfig {
  enabled: boolean;
  defaultType: CacheType;
  environment: CacheEnvironmentConfig;
  defaultOptions: CacheOptions;
  strategies: Record<string, CacheStrategyConfig>;
  userCache: CacheOptions;
  dialogCache: CacheOptions;
  characterCache: CacheOptions;
  settingsCache: CacheOptions;
  analyticsCache: CacheOptions;
  testResultsCache: CacheOptions;
}

export interface CacheStrategyConfig {
  type: CacheType;
  options: CacheOptions;
  preload?: boolean;
}

/**
 * Конфигурация кэша для разных типов данных
 */
export default registerAs('cache', (): CacheConfig => {
  // Получаем параметры из переменных окружения
  const defaultType = (process.env.CACHE_TYPE || 'memory') as CacheType;
  const defaultTtl = parseInt(process.env.CACHE_DEFAULT_TTL || '3600', 10);
  const enableDetailedStats = process.env.CACHE_ENABLE_DETAILED_STATS === 'true';

  // Настройки Redis
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisPassword = process.env.REDIS_PASSWORD;
  const redisDb = parseInt(process.env.REDIS_DB || '0', 10);

  // Настройки для автоматической очистки
  const autoCleanupThreshold = parseInt(
    process.env.CACHE_AUTO_CLEANUP_THRESHOLD || '104857600',
    10,
  ); // 100MB
  const autoCleanupInterval = process.env.CACHE_AUTO_CLEANUP_INTERVAL || '0 0 * * *'; // каждый день в полночь

  // Настройки для предварительного прогрева
  const enablePrewarm = process.env.CACHE_ENABLE_PREWARM === 'true';
  const prewarmInterval = process.env.CACHE_PREWARM_INTERVAL || '0 */6 * * *'; // каждые 6 часов

  // Опции Redis для стратегий с Redis
  const redisOptions = {
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    db: redisDb,
  };

  return {
    enabled: process.env.CACHE_ENABLED !== 'false',
    defaultType,

    environment: {
      defaultTtl,
      enableDetailedStats,
      redisHost,
      redisPort,
      redisPassword,
      redisDb,
      autoCleanupThreshold,
      autoCleanupInterval,
      enablePrewarm,
      prewarmInterval,
    },

    defaultOptions: {
      ttl: defaultTtl,
      enableDetailedStats,
      maxItems: 10000, // для in-memory кэша
      redisOptions,
    },

    // Стратегии кэширования для разных типов данных
    strategies: {
      // Кэш для диалогов (долгоживущие данные)
      dialog: {
        type: defaultType,
        options: {
          ttl: 86400, // 24 часа
          keyPrefix: 'dialog',
          enableDetailedStats,
          redisOptions,
        },
        preload: true,
      },

      // Кэш для пользователей (средняя продолжительность жизни)
      user: {
        type: defaultType,
        options: {
          ttl: 3600, // 1 час
          keyPrefix: 'user',
          enableDetailedStats,
          redisOptions,
        },
        preload: true,
      },

      // Кэш для персонажей (долгоживущие данные)
      character: {
        type: defaultType,
        options: {
          ttl: 86400, // 24 часа
          keyPrefix: 'character',
          enableDetailedStats,
          redisOptions,
        },
        preload: true,
      },

      // Кэш для настроек персонажей (средняя продолжительность жизни)
      characterSettings: {
        type: defaultType,
        options: {
          ttl: 7200, // 2 часа
          keyPrefix: 'character_settings',
          enableDetailedStats,
          redisOptions,
        },
        preload: false,
      },

      // Кэш для действий (короткоживущие данные)
      action: {
        type: defaultType,
        options: {
          ttl: 1800, // 30 минут
          keyPrefix: 'action',
          enableDetailedStats,
          redisOptions,
        },
        preload: false,
      },

      // Кэш для REST API (очень короткоживущие данные)
      api: {
        type: defaultType,
        options: {
          ttl: 60, // 1 минута
          keyPrefix: 'api',
          enableDetailedStats,
          redisOptions,
        },
        preload: false,
      },

      // Кэш для аналитики (долгоживущие данные, но с меньшим приоритетом)
      analytics: {
        type: defaultType,
        options: {
          ttl: 259200, // 3 дня
          keyPrefix: 'analytics',
          enableDetailedStats,
          redisOptions,
        },
        preload: false,
      },
    },

    userCache: {
      ttl: 3600, // 1 час
      keyPrefix: 'user:',
      maxItems: 5000,
      enableDetailedStats: true,
    },
    dialogCache: {
      ttl: 1800, // 30 минут
      keyPrefix: 'dialog:',
      maxItems: 10000,
      enableDetailedStats: true,
    },
    characterCache: {
      ttl: 7200, // 2 часа
      keyPrefix: 'character:',
      maxItems: 1000,
      enableDetailedStats: true,
    },
    settingsCache: {
      ttl: 86400, // 24 часа
      keyPrefix: 'settings:',
      maxItems: 500,
      enableDetailedStats: true,
    },
    analyticsCache: {
      ttl: 600, // 10 минут
      keyPrefix: 'analytics:',
      maxItems: 2000,
      enableDetailedStats: true,
    },
    testResultsCache: {
      ttl: 3600, // 1 час
      keyPrefix: 'test-results:',
      maxItems: 1000,
      enableDetailedStats: true,
    },
  };
});

/**
 * Получает тип кэша в зависимости от окружения
 * В продакшне используем Redis, в разработке - память
 */
export function getCacheType(): CacheType {
  const env = process.env.NODE_ENV || 'development';
  const forceMemory = process.env.FORCE_MEMORY_CACHE === 'true';

  if (forceMemory) {
    return CacheType.MEMORY;
  }

  return env === 'production' ? CacheType.REDIS : CacheType.MEMORY;
}

/**
 * Проверяет, нужно ли прогревать кэш при запуске
 */
export function shouldPrewarmCache(): boolean {
  return process.env.PREWARM_CACHE === 'true';
}

/**
 * Настройки подключения к Redis
 */
export function getRedisConfig() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  };
}

/**
 * Получает настройки кэширования в зависимости от типа кэша
 * и добавляет настройки Redis, если необходимо
 */
export function getCacheOptions(options: CacheOptions): CacheOptions {
  const cacheType = getCacheType();
  const result = { ...options };

  if (cacheType === CacheType.REDIS) {
    result.redisOptions = getRedisConfig();
  }

  return result;
}

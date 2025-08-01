import { Injectable, Inject } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';

/**
 * Параметры кеширования
 */
export interface CacheOptions {
  /** TTL в секундах */
  ttl: number;
  /** Префикс ключа кеша */
  prefix: string;
  /** Функция генерации ключа на основе аргументов */
  keyGenerator?: (...args: any[]) => string;
  /** Условие для кеширования */
  condition?: (...args: any[]) => boolean;
}

/**
 * Декоратор для автоматического кеширования методов
 */
export function CacheMethod(options: CacheOptions) {
  return function (_target: unknown, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: { cacheService?: CacheService }, ...args: unknown[]) {
      const cacheService = this.cacheService;

      if (!cacheService) {
        // Если нет сервиса кеширования, выполняем метод напрямую
        return originalMethod.apply(this, args);
      }

      // Проверяем условие кеширования
      if (options.condition && !options.condition(...args)) {
        return originalMethod.apply(this, args);
      }

      // Генерируем ключ кеша
      const cacheKey = options.keyGenerator
        ? `${options.prefix}:${options.keyGenerator(...args)}`
        : `${options.prefix}:${propertyName}:${JSON.stringify(args)}`;

      try {
        // Пытаемся получить из кеша
        const cached = await cacheService.get(cacheKey);
        if (cached !== null && cached !== undefined) {
          return cached;
        }

        // Выполняем метод
        const result = await originalMethod.apply(this, args);

        // Кешируем результат, если он не null/undefined
        if (result !== null && result !== undefined) {
          await cacheService.set(cacheKey, result, options.ttl);
        }

        return result;
      } catch (error) {
        // При ошибке кеширования выполняем метод напрямую
        console.warn(`Cache error for ${propertyName}:`, error);
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * Декоратор для инвалидации кеша
 */
export function InvalidateCache(patterns: string[] | ((this: any, ...args: any[]) => string[])) {
  return function (_target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);

      const cacheService: CacheService = this.cacheService;
      if (cacheService) {
        try {
          const patternsToInvalidate =
            typeof patterns === 'function' ? patterns.apply(this, args) : patterns;

          await Promise.all(patternsToInvalidate.map(pattern => cacheService.del(pattern)));
        } catch (error) {
          console.warn(`Cache invalidation error for ${propertyName}:`, error);
        }
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Декоратор для инъекции CacheService
 */
export function InjectCacheService() {
  return Inject(CacheService);
}

/**
 * Миксин для добавления возможностей кеширования в сервис
 */
export function WithCaching<T extends new (...args: any[]) => any>(Base: T) {
  @Injectable()
  class CachingMixin extends Base {
    constructor(...args: any[]) {
      super(...args);
    }

    @InjectCacheService()
    protected cacheService!: CacheService;

    /**
     * Получить данные с кешированием
     */
    protected async getCached<R>(
      key: string,
      factory: () => Promise<R>,
      ttl: number = 600,
    ): Promise<R> {
      if (!this.cacheService) {
        return factory();
      }

      try {
        const cached = await this.cacheService.get<R>(key);
        if (cached !== null && cached !== undefined) {
          return cached;
        }

        const result = await factory();
        if (result !== null && result !== undefined) {
          await this.cacheService.set(key, result, ttl);
        }

        return result;
      } catch (error) {
        console.warn(`Cache error for key ${key}:`, error);
        return factory();
      }
    }

    /**
     * Инвалидировать ключи кеша
     */
    protected async invalidateCache(patterns: string[]): Promise<void> {
      if (this.cacheService) {
        try {
          await Promise.all(patterns.map(pattern => this.cacheService.del(pattern)));
        } catch (error) {
          console.warn('Cache invalidation error:', error);
        }
      }
    }

    /**
     * Получить все ключи кеша по паттерну
     */
    protected async getCacheKeys(pattern?: string): Promise<string[]> {
      if (!this.cacheService) {
        return [];
      }

      try {
        const allKeys = await this.cacheService.keys();
        return pattern ? allKeys.filter(key => key.includes(pattern)) : allKeys;
      } catch (error) {
        console.warn('Error getting cache keys:', error);
        return [];
      }
    }

    /**
     * Очистить весь кеш сервиса
     */
    protected async clearServiceCache(servicePrefix: string): Promise<void> {
      const keys = await this.getCacheKeys(servicePrefix);
      await this.invalidateCache(keys);
    }
  }

  return CachingMixin as T &
    (new (...args: any[]) => {
      getCached<R>(key: string, factory: () => Promise<R>, ttl?: number): Promise<R>;
      invalidateCache(patterns: string[]): Promise<void>;
      getCacheKeys(pattern?: string): Promise<string[]>;
      clearServiceCache(servicePrefix: string): Promise<void>;
    });
}

/**
 * Стандартные опции кеширования для разных типов данных
 */
export const CacheProfiles = {
  /** Стабильные данные (персонажи, конфигурация) */
  STABLE: { ttl: 3600, prefix: 'stable' },

  /** Данные средней изменчивости (потребности, состояния) */
  MEDIUM: { ttl: 1800, prefix: 'medium' },

  /** Быстро изменяющиеся данные (поиск, временные результаты) */
  FAST: { ttl: 900, prefix: 'fast' },

  /** Очень быстро изменяющиеся данные (диалоги, активность) */
  REALTIME: { ttl: 300, prefix: 'realtime' },
} as const;

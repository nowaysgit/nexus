/**
 * Интерфейс для основных операций кэширования
 */
export interface Cache {
  /**
   * Получить значение из кэша
   * @param key Ключ кэша
   * @param defaultValue Значение по умолчанию, если ключ не найден
   */
  get<T>(key: string, defaultValue?: T): Promise<T | undefined>;

  /**
   * Установить значение в кэш
   * @param key Ключ кэша
   * @param value Значение для сохранения
   * @param ttl Время жизни в секундах (опционально)
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Проверить наличие ключа в кэше
   * @param key Ключ для проверки
   */
  has(key: string): Promise<boolean>;

  /**
   * Удалить ключ из кэша
   * @param key Ключ для удаления
   */
  delete(key: string): Promise<boolean>;

  /**
   * Очистить весь кэш
   */
  clear(): Promise<void>;

  /**
   * Получить список всех ключей в кэше
   */
  keys(): Promise<string[]>;

  /**
   * Получить статистику использования кэша
   */
  getStats(): Promise<CacheStats>;
}

/**
 * Упрощенная статистика использования кэша
 */
export interface CacheStats {
  /** Количество элементов в кэше */
  size: number;
  /** Процент хитов кэша */
  hitRate: number;
  /** Количество успешных обращений */
  hits: number;
  /** Количество промахов */
  misses: number;
  /** Общее количество обращений */
  totalRequests: number;
  /** Использование памяти в байтах */
  memoryUsage?: number;
  /** Время создания кэша */
  createdAt: Date;
}

/**
 * Тип кэша
 */
export enum CacheType {
  MEMORY = 'memory',
  REDIS = 'redis',
}

/**
 * Опции конфигурации кэша
 */
export interface CacheOptions {
  /** Время жизни по умолчанию в секундах */
  ttl?: number;
  /** Максимальное количество элементов */
  maxItems?: number;
  /** Опции Redis */
  redisOptions?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
  /** Префикс ключей */
  keyPrefix?: string;
  /** Детальная статистика */
  enableDetailedStats?: boolean;
}

/**
 * Фабрика для создания кэшей
 */
export interface CacheFactory {
  createCache(type: CacheType, options?: CacheOptions): Cache;
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { CacheStats } from './cache.interface';
import { LogService } from '../logging/log.service';

/**
 * Элемент кэша
 */
interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

/**
 * Основной сервис кэширования в памяти
 * Единый сервис кэширования для всего приложения
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly storage = new Map<string, CacheItem<unknown>>();
  private readonly defaultTtl: number = 3600; // 1 час в секундах
  private readonly maxItems: number = 1000;
  private readonly keyPrefix: string = '';

  // Простая статистика
  private hits = 0;
  private misses = 0;

  // Интервал очистки
  private cleanupInterval: NodeJS.Timeout;

  constructor(private readonly logService: LogService) {
    // Запускаем очистку каждые 5 минут
    this.cleanupInterval = setInterval(
      () => {
        this.cleanExpired();
      },
      5 * 60 * 1000,
    );

    this.logService.log('Упрощенный кэш инициализирован');
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.storage.clear();
    this.logService.log('Упрощенный кэш очищен');
  }

  /**
   * Получить значение из кэша
   */
  async get<T>(key: string, defaultValue?: T): Promise<T | null> {
    const normalizedKey = this.normalizeKey(key);
    const item = this.storage.get(normalizedKey) as CacheItem<T> | undefined;

    if (!item) {
      this.misses++;
      return defaultValue !== undefined ? defaultValue : null;
    }

    if (this.isExpired(item)) {
      this.storage.delete(normalizedKey);
      this.misses++;
      return defaultValue !== undefined ? defaultValue : null;
    }

    this.hits++;
    return item.value;
  }

  /**
   * Установить значение в кэш
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const normalizedKey = this.normalizeKey(key);
    const actualTtl = ttl !== undefined ? ttl : this.defaultTtl;
    const expiresAt = Date.now() + actualTtl * 1000;

    // Проверяем лимит
    if (!this.storage.has(normalizedKey) && this.storage.size >= this.maxItems) {
      this.evictOldest();
    }

    this.storage.set(normalizedKey, { value, expiresAt });
  }

  /**
   * Проверить наличие ключа
   */
  async has(key: string): Promise<boolean> {
    const normalizedKey = this.normalizeKey(key);
    const item = this.storage.get(normalizedKey);

    if (!item) {
      this.misses++;
      return false;
    }

    if (this.isExpired(item)) {
      this.storage.delete(normalizedKey);
      this.misses++;
      return false;
    }

    this.hits++;
    return true;
  }

  /**
   * Удалить ключ
   */
  async del(key: string): Promise<boolean> {
    const normalizedKey = this.normalizeKey(key);
    return this.storage.delete(normalizedKey);
  }

  /**
   * Удалить ключ (псевдоним для del)
   */
  async delete(key: string): Promise<boolean> {
    return this.del(key);
  }

  /**
   * Очистить весь кэш
   */
  async clear(): Promise<void> {
    this.storage.clear();
    this.hits = 0;
    this.misses = 0;
    this.logService.debug('Кэш очищен');
  }

  /**
   * Получить все ключи
   */
  async keys(): Promise<string[]> {
    const keys: string[] = [];

    for (const [key, item] of this.storage) {
      if (!this.isExpired(item)) {
        keys.push(this.denormalizeKey(key));
      }
    }

    return keys;
  }

  /**
   * Получить статистику кэша
   */
  async getStats(): Promise<CacheStats> {
    const total = this.hits + this.misses;
    return {
      size: this.storage.size,
      hitRate: total > 0 ? this.hits / total : 0,
      hits: this.hits,
      misses: this.misses,
      totalRequests: total,
      createdAt: new Date(), // Приблизительное время создания
    };
  }

  /**
   * Получить информацию о кэше
   */
  getInfo(): Record<string, unknown> {
    const stats = this.getStats();
    return {
      type: 'SimpleMemoryCache',
      version: '1.0.0',
      description: 'Упрощенный кэш в памяти',
      stats,
      settings: {
        defaultTtl: this.defaultTtl,
        maxItems: this.maxItems,
        keyPrefix: this.keyPrefix,
      },
    };
  }

  // ======= ПРИВАТНЫЕ МЕТОДЫ =======

  /**
   * Нормализует ключ, добавляя префикс
   */
  private normalizeKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}${key}` : key;
  }

  /**
   * Убирает префикс из ключа
   */
  private denormalizeKey(normalizedKey: string): string {
    return this.keyPrefix && normalizedKey.startsWith(this.keyPrefix)
      ? normalizedKey.slice(this.keyPrefix.length)
      : normalizedKey;
  }

  /**
   * Проверяет, истек ли срок действия элемента
   */
  private isExpired(item: CacheItem<any>): boolean {
    return Date.now() > item.expiresAt;
  }

  /**
   * Удаляет самый старый элемент
   */
  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, item] of this.storage) {
      if (item.expiresAt < oldestTime) {
        oldestTime = item.expiresAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.storage.delete(oldestKey);
      this.logService.debug(`Удален старый элемент кэша: ${oldestKey}`);
    }
  }

  /**
   * Очищает истекшие элементы
   */
  private cleanExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.storage) {
      if (now > item.expiresAt) {
        this.storage.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logService.debug(`Очищено истекших элементов кэша: ${cleaned}`);
    }
  }
}

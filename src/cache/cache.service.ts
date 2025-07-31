import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { CacheStats } from './cache.interface';
import { LogService } from '../logging/log.service';

/**
 * Элемент кэша
 */
interface CacheItem<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
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
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Флаг, указывающий, что сервис был остановлен
  private isStopped = false;

  constructor(private readonly logService: LogService) {
    // Запускаем очистку каждую минуту, но только если не в тестовом окружении
    if (process.env.NODE_ENV !== 'test') {
      this.startCleanupInterval();
    }

    this.logService.setContext('CacheService');
    this.logService.log('Упрощенный кэш инициализирован');
  }

  /**
   * Запускает интервал очистки
   */
  private startCleanupInterval(): void {
    // Сначала останавливаем существующий интервал, если есть
    this.stopCleanupInterval();

    // Запускаем новый интервал очистки каждую минуту вместо 5 минут
    // для более частой очистки истекших элементов
    this.cleanupInterval = setInterval(() => {
      this.cleanExpired();
    }, 60 * 1000);

    // Убеждаемся, что интервал не блокирует завершение процесса
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Останавливает интервал очистки
   */
  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Метод для явной остановки сервиса (полезно для тестов)
   */
  async stop(): Promise<void> {
    this.isStopped = true;
    this.stopCleanupInterval();
    this.storage.clear();
    this.hits = 0;
    this.misses = 0;
    this.logService.log('Кэш остановлен и очищен');
  }

  onModuleDestroy() {
    this.isStopped = true;
    this.stopCleanupInterval();
    this.storage.clear();
    this.logService.log('Упрощенный кэш очищен при уничтожении модуля');
  }

  /**
   * Получить значение из кэша
   */
  async get<T>(key: string, defaultValue?: T): Promise<T | null> {
    // Проверяем, что сервис не остановлен
    if (this.isStopped) {
      return defaultValue !== undefined ? defaultValue : null;
    }

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
    // Проверяем, что сервис не остановлен
    if (this.isStopped) {
      return;
    }

    // Не кэшируем null или undefined значения
    if (value === null || value === undefined) {
      return;
    }

    const normalizedKey = this.normalizeKey(key);
    const actualTtl = ttl !== undefined ? ttl : this.defaultTtl;
    const now = Date.now();
    const expiresAt = now + actualTtl * 1000;

    // Проверяем лимит и очищаем истекшие элементы, если приближаемся к лимиту
    if (!this.storage.has(normalizedKey) && this.storage.size >= this.maxItems * 0.9) {
      this.cleanExpired();

      // Если после очистки все еще превышаем лимит, удаляем старые элементы
      if (this.storage.size >= this.maxItems) {
        this.evictOldest();
      }
    }

    this.storage.set(normalizedKey, { value, expiresAt, createdAt: now });
  }

  /**
   * Проверить наличие ключа
   */
  async has(key: string): Promise<boolean> {
    // Проверяем, что сервис не остановлен
    if (this.isStopped) {
      return false;
    }

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
    // Проверяем, что сервис не остановлен
    if (this.isStopped) {
      return false;
    }

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
    // Проверяем, что сервис не остановлен
    if (this.isStopped) {
      return [];
    }

    const keys: string[] = [];
    const now = Date.now();

    for (const [key, item] of this.storage) {
      if (item.expiresAt > now) {
        keys.push(this.denormalizeKey(key));
      } else {
        // Удаляем истекшие элементы при обходе
        this.storage.delete(key);
      }
    }

    return keys;
  }

  /**
   * Получить статистику кэша
   */
  async getStats(): Promise<CacheStats> {
    // Проверяем, что сервис не остановлен
    if (this.isStopped) {
      return {
        size: 0,
        hitRate: 0,
        hits: 0,
        misses: 0,
        totalRequests: 0,
        createdAt: new Date(),
      };
    }

    // Очищаем истекшие элементы перед подсчетом статистики
    this.cleanExpired();

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
      version: '1.1.0',
      description: 'Упрощенный кэш в памяти с защитой от утечек',
      stats,
      settings: {
        defaultTtl: this.defaultTtl,
        maxItems: this.maxItems,
        keyPrefix: this.keyPrefix,
        isStopped: this.isStopped,
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
  private isExpired(item: CacheItem<unknown>): boolean {
    return Date.now() > item.expiresAt;
  }

  /**
   * Удаляет самые старые элементы из кэша
   */
  private evictOldest(): void {
    // Если кэш пуст, нечего удалять
    if (this.storage.size === 0) {
      return;
    }

    // Количество элементов для удаления (10% от максимального размера или минимум 1)
    const evictionCount = Math.max(1, Math.floor(this.maxItems * 0.1));

    // Преобразуем Map в массив пар [ключ, значение]
    const entries = Array.from(this.storage.entries());

    // Сортируем по времени создания (от старых к новым)
    entries.sort((a, b) => a[1].createdAt - b[1].createdAt);

    // Удаляем самые старые элементы
    for (let i = 0; i < Math.min(evictionCount, entries.length); i++) {
      this.storage.delete(entries[i][0]);
    }

    this.logService.debug(
      `Удалено ${Math.min(evictionCount, entries.length)} старых элементов из кэша`,
    );
  }

  /**
   * Очищает истекшие элементы кэша
   */
  private cleanExpired(): void {
    const now = Date.now();
    let expiredCount = 0;

    // Удаляем все истекшие элементы
    for (const [key, item] of this.storage) {
      if (item.expiresAt <= now) {
        this.storage.delete(key);
        expiredCount++;
      }
    }

    // Если размер кэша приближается к лимиту (более 90%), удаляем старые элементы
    if (this.storage.size > this.maxItems * 0.9) {
      this.evictOldest();
    }

    if (expiredCount > 0) {
      this.logService.debug(`Очищено ${expiredCount} истекших элементов кэша`);
    }
  }
}

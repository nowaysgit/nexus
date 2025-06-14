import { Injectable } from '@nestjs/common';

/**
 * Мок RollbarService для использования в тестах
 * Имитирует все методы оригинального RollbarService, но не требует ConfigService
 */
@Injectable()
export class MockRollbarService {
  private readonly enabled = false;

  constructor() {
    // Мок не требует реальной конфигурации
  }

  onModuleInit(): void {
    // Заглушка инициализации
    console.log('[MOCK ROLLBAR] Initialized');
  }

  /**
   * Логирует информационное сообщение
   */
  info(message: string, extra?: Record<string, any>): void {
    // Заглушка
    if (this.enabled) {
      console.log(`[MOCK ROLLBAR INFO] ${message}`);
    }
  }

  /**
   * Логирует сообщение с уровнем debug
   */
  debug(message: string, extra?: Record<string, any>): void {
    // Заглушка
    if (this.enabled) {
      console.log(`[MOCK ROLLBAR DEBUG] ${message}`);
    }
  }

  /**
   * Логирует предупреждающее сообщение
   */
  warn(message: string, extra?: Record<string, any>): void {
    // Заглушка
    if (this.enabled) {
      console.log(`[MOCK ROLLBAR WARNING] ${message}`);
    }
  }

  /**
   * Логирует ошибку
   */
  error(error: Error, extra?: Record<string, any>): void {
    // Заглушка
    if (this.enabled) {
      console.error(`[MOCK ROLLBAR ERROR] ${error.message}`);
    }
  }

  /**
   * Логирует критическую ошибку
   */
  critical(error: Error, extra?: Record<string, any>): void {
    // Заглушка
    if (this.enabled) {
      console.error(`[MOCK ROLLBAR CRITICAL] ${error.message}`);
    }
  }
} 
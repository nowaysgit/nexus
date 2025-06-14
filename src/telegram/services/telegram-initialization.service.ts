import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { LogService } from '../../logging/log.service';
import { SessionData } from '../interfaces/context.interface';

/**
 * Тип для данных сессии
 */
interface SessionDataUpdate {
  [key: string]: string | number | boolean | object | undefined;
}

/**
 * Упрощенный сервис управления сессиями пользователей Telegram
 */
@Injectable()
export class TelegramInitializationService implements OnModuleInit, OnApplicationShutdown {
  private readonly logService: LogService;
  private userSessions: Map<number, SessionData> = new Map();

  constructor(logService: LogService) {
    this.logService = logService.setContext(TelegramInitializationService.name);
  }

  /**
   * Инициализация при запуске модуля
   */
  async onModuleInit(): Promise<void> {
    this.logService.log('Telegram инициализация запущена');
  }

  /**
   * Освобождение ресурсов при остановке приложения
   */
  onApplicationShutdown(signal?: string): void {
    this.logService.log(`Остановка Telegram инициализации (сигнал: ${signal || 'неизвестный'})`);
    this.userSessions.clear();
  }

  // === Методы управления сессиями ===

  /**
   * Получить сессию пользователя
   */
  getSession(userId: number): SessionData | undefined {
    return this.userSessions.get(userId);
  }

  /**
   * Установить сессию пользователя
   */
  setSession(userId: number, sessionData: SessionData): void {
    this.userSessions.set(userId, sessionData);
  }

  /**
   * Проверить, находится ли пользователь в определенном состоянии
   */
  isInState(userId: number, state: string): boolean {
    const session = this.userSessions.get(userId);
    return session?.state === state;
  }

  /**
   * Очистить сессию пользователя
   */
  clearSession(userId: number): void {
    this.userSessions.delete(userId);
  }

  /**
   * Установить начальное состояние сессии
   */
  setInitialState(userId: number): void {
    this.userSessions.set(userId, { state: 'initial', data: {} });
  }

  /**
   * Обновить данные сессии
   */
  updateSessionData(userId: number, data: SessionDataUpdate): void {
    const session = this.userSessions.get(userId);
    if (session) {
      session.data = { ...session.data, ...data };
      this.userSessions.set(userId, session);
    }
  }

  /**
   * Перейти к новому состоянию
   */
  transitionTo(userId: number, newState: string, data: SessionDataUpdate = {}): void {
    const existingData = this.userSessions.get(userId)?.data || {};
    this.userSessions.set(userId, {
      state: newState,
      data: { ...existingData, ...data },
    });
  }
}

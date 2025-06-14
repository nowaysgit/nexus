import { Injectable, Logger } from '@nestjs/common';

export interface SessionData {
  state: string;
  data: any;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private userSessions: Map<number, SessionData> = new Map();

  constructor() {}

  // Получить сессию пользователя
  get(userId: number): SessionData | undefined {
    return this.userSessions.get(userId);
  }

  // Установить сессию пользователя
  set(userId: number, sessionData: SessionData): void {
    this.userSessions.set(userId, sessionData);
  }

  // Проверить, находится ли пользователь в определенном состоянии
  isInState(userId: number, state: string): boolean {
    const session = this.userSessions.get(userId);
    return session?.state === state;
  }

  // Очистить сессию пользователя
  clear(userId: number): void {
    this.userSessions.delete(userId);
  }

  // Установить начальное состояние сессии
  setInitialState(userId: number): void {
    this.userSessions.set(userId, { state: 'initial', data: {} });
  }

  // Обновить данные сессии
  updateSessionData(userId: number, data: any): void {
    const session = this.userSessions.get(userId);
    if (session) {
      session.data = { ...session.data, ...data };
      this.userSessions.set(userId, session);
    }
  }

  // Перейти к новому состоянию
  transitionTo(userId: number, newState: string, data: any = {}): void {
    const existingData = this.userSessions.get(userId)?.data || {};
    this.userSessions.set(userId, {
      state: newState,
      data: { ...existingData, ...data },
    });
  }
}

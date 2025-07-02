import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LogService } from '../../logging/log.service';
import { BaseService } from '../../common/base/base.service';
import { CharacterAction } from '../interfaces/behavior.interfaces';

export interface ActionTimer {
  actionId: string;
  scheduledFor: Date;
  callback: () => Promise<void>;
  interval?: number;
  isRecurring: boolean;
}

export interface ScheduledAction {
  id: string;
  action: CharacterAction;
  executeAt: Date;
  status: 'scheduled' | 'executed' | 'cancelled';
  executedAt?: Date;
}

export interface CronJob {
  id: string;
  action: CharacterAction;
  cronExpression: string;
  isActive: boolean;
  maxExecutions?: number;
  executionCount: number;
  lastExecution?: Date;
  nextExecution?: Date;
}

/**
 * Сервис планирования и управления таймерами действий персонажей
 * Отвечает за отложенные действия, повторяющиеся задачи и cron-планировщик
 */
@Injectable()
export class ActionSchedulerService extends BaseService {
  private scheduledActions = new Map<string, ScheduledAction>();
  private cronJobs = new Map<string, CronJob>();
  private actionTimers = new Map<string, ActionTimer>();
  private timeouts = new Map<string, NodeJS.Timeout>();
  private isProcessing = false;
  private idCounter = 0;

  constructor(logService: LogService) {
    super(logService);
  }

  /**
   * Планирует действие с задержкой или на конкретное время
   */
  scheduleAction(action: CharacterAction, delayOrDate: number | Date): ScheduledAction {
    return this.withErrorHandlingSync('планировании действия', () => {
      const id = `scheduled_${++this.idCounter}`;
      const executeAt =
        delayOrDate instanceof Date ? delayOrDate : new Date(Date.now() + delayOrDate);

      const scheduledAction: ScheduledAction = {
        id,
        action,
        executeAt,
        status: 'scheduled',
      };

      this.scheduledActions.set(id, scheduledAction);

      // Планируем выполнение только если время в будущем
      const delay = executeAt.getTime() - Date.now();
      if (delay > 0) {
        const timeout = setTimeout(() => {
          this.executeScheduledAction(id);
        }, delay);
        this.timeouts.set(id, timeout);
      }
      // Если время в прошлом, действие остается в статусе 'scheduled'
      // и будет возвращено методом getReadyActions()

      this.logInfo(`Действие ${action.type} запланировано на ${executeAt.toISOString()}`);
      return scheduledAction;
    });
  }

  /**
   * Отменяет запланированное действие
   */
  cancelScheduledAction(actionId: string): boolean {
    return this.withErrorHandlingSync('отмене запланированного действия', () => {
      const scheduledAction = this.scheduledActions.get(actionId);
      if (scheduledAction && scheduledAction.status === 'scheduled') {
        scheduledAction.status = 'cancelled';

        // Отменяем setTimeout если есть
        const timeout = this.timeouts.get(actionId);
        if (timeout) {
          clearTimeout(timeout);
          this.timeouts.delete(actionId);
        }

        this.logInfo(`Запланированное действие ${actionId} отменено`);
        return true;
      }
      return false;
    });
  }

  /**
   * Получает все запланированные действия для персонажа
   */
  getScheduledActions(characterId: string): ScheduledAction[] {
    return Array.from(this.scheduledActions.values()).filter(scheduled => {
      const actionCharacterId = scheduled.action.metadata?.characterId;
      return actionCharacterId?.toString() === characterId;
    });
  }

  /**
   * Получает действия готовые к выполнению
   */
  getReadyActions(): ScheduledAction[] {
    const now = new Date();
    return Array.from(this.scheduledActions.values()).filter(
      scheduled => scheduled.status === 'scheduled' && scheduled.executeAt <= now,
    );
  }

  /**
   * Помечает действие как выполненное
   */
  markAsExecuted(actionId: string): void {
    this.withErrorHandlingSync('пометке действия как выполненного', () => {
      const scheduledAction = this.scheduledActions.get(actionId);
      if (scheduledAction) {
        scheduledAction.status = 'executed';
        scheduledAction.executedAt = new Date();
        this.logInfo(`Действие ${actionId} помечено как выполненное`);
      }
    });
  }

  /**
   * Создает cron-задачу
   */
  createCronJob(
    action: CharacterAction,
    cronExpression: string,
    options: { maxExecutions?: number } = {},
  ): CronJob {
    return this.withErrorHandlingSync('создании cron-задачи', () => {
      const id = `cron_${++this.idCounter}`;

      const cronJob: CronJob = {
        id,
        action,
        cronExpression,
        isActive: true,
        maxExecutions: options.maxExecutions,
        executionCount: 0,
      };

      this.cronJobs.set(id, cronJob);
      this.logInfo(`Создана cron-задача ${id} с выражением ${cronExpression}`);
      return cronJob;
    });
  }

  /**
   * Приостанавливает cron-задачу
   */
  pauseCronJob(jobId: string): void {
    this.withErrorHandlingSync('приостановке cron-задачи', () => {
      const cronJob = this.cronJobs.get(jobId);
      if (cronJob) {
        cronJob.isActive = false;
        this.logInfo(`Cron-задача ${jobId} приостановлена`);
      }
    });
  }

  /**
   * Возобновляет cron-задачу
   */
  resumeCronJob(jobId: string): void {
    this.withErrorHandlingSync('возобновлении cron-задачи', () => {
      const cronJob = this.cronJobs.get(jobId);
      if (cronJob) {
        cronJob.isActive = true;
        this.logInfo(`Cron-задача ${jobId} возобновлена`);
      }
    });
  }

  /**
   * Удаляет cron-задачу
   */
  deleteCronJob(jobId: string): boolean {
    return this.withErrorHandlingSync('удалении cron-задачи', () => {
      const deleted = this.cronJobs.delete(jobId);
      if (deleted) {
        this.logInfo(`Cron-задача ${jobId} удалена`);
      }
      return deleted;
    });
  }

  /**
   * Получает cron-задачи для персонажа
   */
  getCronJobs(characterId: string): CronJob[] {
    return Array.from(this.cronJobs.values()).filter(job => {
      const actionCharacterId = job.action.metadata?.characterId;
      return actionCharacterId?.toString() === characterId;
    });
  }

  /**
   * Получает время следующего выполнения cron-задачи
   */
  getNextCronExecution(jobId: string): Date | null {
    const cronJob = this.cronJobs.get(jobId);
    if (!cronJob || !cronJob.isActive) {
      return null;
    }

    // Простая имитация расчета следующего выполнения
    // В реальной реализации здесь должна быть библиотека для парсинга cron-выражений
    const now = new Date();
    return new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 день для теста
  }

  /**
   * Очищает выполненные и отмененные действия
   */
  clearScheduledActions(): number {
    return this.withErrorHandlingSync('очистке запланированных действий', () => {
      let clearedCount = 0;
      for (const [id, action] of this.scheduledActions.entries()) {
        if (action.status === 'executed' || action.status === 'cancelled') {
          this.scheduledActions.delete(id);
          clearedCount++;
        }
      }
      this.logInfo(`Очищено ${clearedCount} завершенных действий`);
      return clearedCount;
    });
  }

  /**
   * Проверяет есть ли у персонажа запланированные действия
   */
  hasScheduledActions(characterId: string): boolean {
    return this.getScheduledActions(characterId).some(action => action.status === 'scheduled');
  }

  /**
   * Очищает все состояние сервиса (для тестов)
   */
  clearAllState(): void {
    // Очищаем все setTimeout'ы
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }

    this.scheduledActions.clear();
    this.cronJobs.clear();
    this.actionTimers.clear();
    this.timeouts.clear();
    this.idCounter = 0;
    this.isProcessing = false;
  }

  // === МЕТОДЫ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ ===

  /**
   * Получает все запланированные действия (новый интерфейс ActionTimer)
   */
  getScheduledActionsAsTimers(): ActionTimer[] {
    return Array.from(this.actionTimers.values());
  }

  /**
   * Получает запланированные действия для персонажа (новый интерфейс)
   */
  getScheduledActionsForCharacter(characterId: string): ActionTimer[] {
    return Array.from(this.actionTimers.values()).filter(timer => {
      return timer.actionId.includes(`character_${characterId}`);
    });
  }

  /**
   * Создает повторяющуюся задачу
   */
  createRecurringAction(
    actionId: string,
    callback: () => Promise<void>,
    intervalMinutes: number,
  ): void {
    this.withErrorHandlingSync('создании повторяющейся задачи', () => {
      const timer: ActionTimer = {
        actionId,
        scheduledFor: new Date(Date.now() + intervalMinutes * 60 * 1000),
        callback,
        interval: intervalMinutes * 60 * 1000,
        isRecurring: true,
      };

      this.actionTimers.set(actionId, timer);
      this.scheduleRecurringExecution(timer);
      this.logInfo(
        `Создана повторяющаяся задача ${actionId} с интервалом ${intervalMinutes} минут`,
      );
    });
  }

  /**
   * Останавливает повторяющуюся задачу
   */
  stopRecurringAction(actionId: string): boolean {
    return this.withErrorHandlingSync('остановке повторяющейся задачи', () => {
      const timer = this.actionTimers.get(actionId);
      if (timer) {
        this.actionTimers.delete(actionId);
        this.logInfo(`Повторяющаяся задача ${actionId} остановлена`);
        return true;
      }
      return false;
    });
  }

  /**
   * Получает статистику планировщика
   */
  getSchedulerStats(): {
    totalScheduled: number;
    recurringActions: number;
    pendingActions: number;
    nextExecution?: Date;
  } {
    const timers = Array.from(this.actionTimers.values());
    const now = new Date();

    return {
      totalScheduled: timers.length,
      recurringActions: timers.filter(t => t.isRecurring).length,
      pendingActions: timers.filter(t => t.scheduledFor > now).length,
      nextExecution: timers
        .filter(t => t.scheduledFor > now)
        .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())[0]?.scheduledFor,
    };
  }

  /**
   * Cron-задача для обработки отложенных сообщений (каждые 5 минут)
   */
  @Cron('*/5 * * * *')
  async processPendingMessages(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      await this.withErrorHandling('обработке отложенных сообщений', async () => {
        const now = new Date();
        const expiredTimers = Array.from(this.actionTimers.entries()).filter(
          ([, timer]) => timer.scheduledFor <= now,
        );

        for (const [actionId, timer] of expiredTimers) {
          await this.executeScheduledActionTimer(actionId);
          if (!timer.isRecurring) {
            this.actionTimers.delete(actionId);
          }
        }

        if (expiredTimers.length > 0) {
          this.logInfo(`Обработано ${expiredTimers.length} отложенных действий`);
        }
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Cron-задача для обработки проактивных сообщений (каждые 30 минут)
   */
  @Cron('*/30 * * * *')
  async processProactiveMessages(): Promise<void> {
    await this.withErrorHandling('обработке проактивных сообщений', async () => {
      this.logDebug('Обработка проактивных сообщений');
    });
  }

  // === ПРИВАТНЫЕ МЕТОДЫ ===

  /**
   * Выполняет запланированное действие (старый интерфейс ScheduledAction)
   */
  private async executeScheduledAction(actionId: string): Promise<void> {
    const scheduledAction = this.scheduledActions.get(actionId);
    if (!scheduledAction || scheduledAction.status !== 'scheduled') {
      return;
    }

    try {
      this.logInfo(`Выполнение запланированного действия ${scheduledAction.action.type}`);
      scheduledAction.action.status = 'in_progress';
      scheduledAction.action.startTime = new Date();

      // Здесь должна быть логика выполнения действия
      // В реальной реализации это будет делегировано в ActionExecutorService

      this.markAsExecuted(actionId);
    } catch (error) {
      this.logError(
        `Ошибка выполнения запланированного действия: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Выполняет запланированное действие (новый интерфейс ActionTimer)
   */
  private async executeScheduledActionTimer(actionId: string): Promise<void> {
    const timer = this.actionTimers.get(actionId);
    if (!timer) {
      return;
    }

    try {
      await timer.callback();

      // Если это повторяющаяся задача, планируем следующее выполнение
      if (timer.isRecurring && timer.interval) {
        timer.scheduledFor = new Date(Date.now() + timer.interval);
        this.scheduleRecurringExecution(timer);
      }
    } catch (error) {
      this.logError(
        `Ошибка выполнения запланированного действия ${actionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Планирует выполнение повторяющейся задачи
   */
  private scheduleRecurringExecution(timer: ActionTimer): void {
    const delay = timer.scheduledFor.getTime() - Date.now();
    if (delay > 0) {
      setTimeout(() => {
        this.executeScheduledActionTimer(timer.actionId);
      }, delay);
    }
  }
}

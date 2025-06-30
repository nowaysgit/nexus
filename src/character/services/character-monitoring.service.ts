import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { Character } from '../entities/character.entity';
import { LogService } from '../../logging/log.service';
import { BaseService } from '../../common/base/base.service';

/**
 * Интерфейс метрик персонажа
 */
export interface CharacterMetrics {
  characterId: number;
  lastActivity: Date;
  messageCount: number;
  emotionalStateChanges: number;
  motivationExecutions: number;
  frustrationLevel: string;
  averageResponseTime: number;
  errorCount: number;
  schedulerExecutions: number;
  lastSchedulerRun: Date;
  uptime: number; // в секундах
}

/**
 * Интерфейс системных метрик
 */
export interface SystemMetrics {
  totalCharacters: number;
  activeCharacters: number;
  inactiveCharacters: number;
  averageMessageCount: number;
  totalEmotionalStateChanges: number;
  totalMotivationExecutions: number;
  totalErrors: number;
  systemUptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  schedulerPerformance: {
    averageExecutionTime: number;
    successRate: number;
    lastExecutionTime: number;
  };
}

/**
 * Интерфейс события мониторинга
 */
export interface MonitoringEvent {
  type:
    | 'character_activity'
    | 'emotional_change'
    | 'motivation_execution'
    | 'error'
    | 'scheduler_run';
  characterId?: number;
  timestamp: Date;
  data: Record<string, any>;
  executionTime?: number;
  success?: boolean;
}

/**
 * Сервис мониторинга и метрик для фоновых процессов персонажей
 */
@Injectable()
export class CharacterMonitoringService
  extends BaseService
  implements OnModuleInit, OnModuleDestroy
{
  // Хранилище метрик персонажей
  private characterMetrics: Map<number, CharacterMetrics> = new Map();

  // Системные метрики
  private systemStartTime: Date = new Date();
  private totalEmotionalStateChanges: number = 0;
  private totalMotivationExecutions: number = 0;
  private totalErrors: number = 0;
  private schedulerExecutions: number = 0;
  private schedulerExecutionTimes: number[] = [];
  private schedulerSuccessCount: number = 0;

  // Буфер событий для анализа
  private eventBuffer: MonitoringEvent[] = [];
  private readonly maxEventBufferSize = 1000;

  // Интервалы для очистки данных
  private cleanupInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    private readonly eventEmitter: EventEmitter2,
    logService: LogService,
  ) {
    super(logService);
  }

  async onModuleInit(): Promise<void> {
    this.logInfo('Инициализация сервиса мониторинга персонажей');

    // Инициализируем метрики для существующих персонажей
    await this.initializeCharacterMetrics();

    // Запускаем интервалы очистки и агрегации
    this.startCleanupIntervals();

    this.logInfo('Сервис мониторинга персонажей инициализирован');
  }

  async onModuleDestroy(): Promise<void> {
    this.logInfo('Остановка сервиса мониторинга персонажей');

    // Очищаем интервалы
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Сохраняем финальный отчет
    await this.generateFinalReport();

    this.logInfo('Сервис мониторинга персонажей остановлен');
  }

  /**
   * Инициализация метрик для существующих персонажей
   */
  private async initializeCharacterMetrics(): Promise<void> {
    try {
      const characters = await this.characterRepository.find();

      for (const character of characters) {
        this.characterMetrics.set(character.id, {
          characterId: character.id,
          lastActivity: new Date(),
          messageCount: 0,
          emotionalStateChanges: 0,
          motivationExecutions: 0,
          frustrationLevel: 'none',
          averageResponseTime: 0,
          errorCount: 0,
          schedulerExecutions: 0,
          lastSchedulerRun: new Date(),
          uptime: 0,
        });
      }

      this.logInfo(`Инициализированы метрики для ${characters.length} персонажей`);
    } catch (error) {
      this.logError('Ошибка инициализации метрик персонажей', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Запуск интервалов для очистки и агрегации данных
   */
  private startCleanupIntervals(): void {
    // Очистка старых событий каждые 30 минут
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldEvents();
      },
      30 * 60 * 1000,
    );

    // Агрегация метрик каждые 5 минут
    this.metricsInterval = setInterval(
      () => {
        this.aggregateMetrics();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Очистка старых событий из буфера
   */
  private cleanupOldEvents(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 часа назад

    this.eventBuffer = this.eventBuffer.filter(event => event.timestamp > cutoffTime);

    // Если буфер все еще слишком большой, оставляем только последние события
    if (this.eventBuffer.length > this.maxEventBufferSize) {
      this.eventBuffer = this.eventBuffer.slice(-this.maxEventBufferSize);
    }

    this.logDebug(`Очищен буфер событий, осталось ${this.eventBuffer.length} событий`);
  }

  /**
   * Агрегация метрик
   */
  private aggregateMetrics(): void {
    try {
      const systemMetrics = this.getSystemMetrics();

      this.logDebug('Агрегированы системные метрики', {
        totalCharacters: systemMetrics.totalCharacters,
        activeCharacters: systemMetrics.activeCharacters,
        averageMessageCount: systemMetrics.averageMessageCount,
        systemUptime: Math.round(systemMetrics.systemUptime / 3600), // в часах
      });

      // Эмитируем событие с метриками для других сервисов
      this.eventEmitter.emit('monitoring.metrics_aggregated', {
        systemMetrics,
        characterMetrics: Array.from(this.characterMetrics.values()),
        timestamp: new Date(),
      });
    } catch (error) {
      this.logError('Ошибка агрегации метрик', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработчик события активности персонажа
   */
  @OnEvent('character.activity')
  async handleCharacterActivity(payload: {
    characterId: number;
    activityType: string;
    responseTime?: number;
    data?: Record<string, any>;
  }): Promise<void> {
    try {
      const metrics = this.getOrCreateCharacterMetrics(payload.characterId);

      metrics.lastActivity = new Date();
      metrics.messageCount++;

      if (payload.responseTime) {
        // Обновляем среднее время ответа
        const currentAvg = metrics.averageResponseTime;
        const count = metrics.messageCount;
        metrics.averageResponseTime = (currentAvg * (count - 1) + payload.responseTime) / count;
      }

      // Добавляем событие в буфер
      this.addEvent({
        type: 'character_activity',
        characterId: payload.characterId,
        timestamp: new Date(),
        data: payload.data || {},
        executionTime: payload.responseTime,
        success: true,
      });

      this.logDebug(`Обновлена активность персонажа ${payload.characterId}`, {
        activityType: payload.activityType,
        messageCount: metrics.messageCount,
        averageResponseTime: Math.round(metrics.averageResponseTime),
      });
    } catch (error) {
      this.logError('Ошибка обработки активности персонажа', {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработчик события изменения эмоционального состояния
   */
  @OnEvent('emotional_state.changed')
  async handleEmotionalStateChanged(payload: {
    characterId: number;
    oldState: { primary: string };
    newState: { primary: string };
    trigger: string;
  }): Promise<void> {
    try {
      const metrics = this.getOrCreateCharacterMetrics(payload.characterId);
      metrics.emotionalStateChanges++;

      this.totalEmotionalStateChanges++;

      // Добавляем событие в буфер
      this.addEvent({
        type: 'emotional_change',
        characterId: payload.characterId,
        timestamp: new Date(),
        data: {
          oldEmotion: payload.oldState.primary,
          newEmotion: payload.newState.primary,
          trigger: payload.trigger,
        },
        success: true,
      });

      this.logDebug(
        `Зафиксировано изменение эмоционального состояния персонажа ${payload.characterId}`,
        {
          oldEmotion: payload.oldState.primary,
          newEmotion: payload.newState.primary,
          totalChanges: metrics.emotionalStateChanges,
        },
      );
    } catch (error) {
      this.logError('Ошибка обработки изменения эмоционального состояния', {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработчик события выполнения мотивации
   */
  @OnEvent('motivation.executed')
  async handleMotivationExecuted(payload: {
    characterId: number;
    motivationId: string;
    success: boolean;
    executionTime?: number;
  }): Promise<void> {
    try {
      const metrics = this.getOrCreateCharacterMetrics(payload.characterId);
      metrics.motivationExecutions++;

      this.totalMotivationExecutions++;

      // Добавляем событие в буфер
      this.addEvent({
        type: 'motivation_execution',
        characterId: payload.characterId,
        timestamp: new Date(),
        data: {
          motivationId: payload.motivationId,
        },
        executionTime: payload.executionTime,
        success: payload.success,
      });

      this.logDebug(`Зафиксировано выполнение мотивации персонажа ${payload.characterId}`, {
        motivationId: payload.motivationId,
        success: payload.success,
        totalExecutions: metrics.motivationExecutions,
      });
    } catch (error) {
      this.logError('Ошибка обработки выполнения мотивации', {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработчик события выполнения планировщика
   */
  @OnEvent('scheduler.execution')
  async handleSchedulerExecution(payload: {
    characterId?: number;
    taskType: string;
    executionTime: number;
    success: boolean;
    error?: string;
  }): Promise<void> {
    try {
      this.schedulerExecutions++;
      this.schedulerExecutionTimes.push(payload.executionTime);

      if (payload.success) {
        this.schedulerSuccessCount++;
      }

      // Ограничиваем размер массива времен выполнения
      if (this.schedulerExecutionTimes.length > 100) {
        this.schedulerExecutionTimes = this.schedulerExecutionTimes.slice(-100);
      }

      if (payload.characterId) {
        const metrics = this.getOrCreateCharacterMetrics(payload.characterId);
        metrics.schedulerExecutions++;
        metrics.lastSchedulerRun = new Date();
      }

      // Добавляем событие в буфер
      this.addEvent({
        type: 'scheduler_run',
        characterId: payload.characterId,
        timestamp: new Date(),
        data: {
          taskType: payload.taskType,
          error: payload.error,
        },
        executionTime: payload.executionTime,
        success: payload.success,
      });

      this.logDebug(`Зафиксировано выполнение планировщика`, {
        taskType: payload.taskType,
        executionTime: payload.executionTime,
        success: payload.success,
        characterId: payload.characterId,
      });
    } catch (error) {
      this.logError('Ошибка обработки выполнения планировщика', {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработчик ошибок
   */
  @OnEvent('monitoring.error')
  async handleError(payload: {
    characterId?: number;
    errorType: string;
    errorMessage: string;
    context?: Record<string, any>;
  }): Promise<void> {
    try {
      this.totalErrors++;

      if (payload.characterId) {
        const metrics = this.getOrCreateCharacterMetrics(payload.characterId);
        metrics.errorCount++;
      }

      // Добавляем событие в буфер
      this.addEvent({
        type: 'error',
        characterId: payload.characterId,
        timestamp: new Date(),
        data: {
          errorType: payload.errorType,
          errorMessage: payload.errorMessage,
          context: payload.context,
        },
        success: false,
      });

      this.logWarning(`Зафиксирована ошибка`, {
        characterId: payload.characterId,
        errorType: payload.errorType,
        errorMessage: payload.errorMessage,
      });
    } catch (error) {
      this.logError('Ошибка обработки ошибки мониторинга', {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Получение или создание метрик персонажа
   */
  private getOrCreateCharacterMetrics(characterId: number): CharacterMetrics {
    let metrics = this.characterMetrics.get(characterId);

    if (!metrics) {
      metrics = {
        characterId,
        lastActivity: new Date(),
        messageCount: 0,
        emotionalStateChanges: 0,
        motivationExecutions: 0,
        frustrationLevel: 'none',
        averageResponseTime: 0,
        errorCount: 0,
        schedulerExecutions: 0,
        lastSchedulerRun: new Date(),
        uptime: 0,
      };

      this.characterMetrics.set(characterId, metrics);
    }

    return metrics;
  }

  /**
   * Добавление события в буфер
   */
  private addEvent(event: MonitoringEvent): void {
    this.eventBuffer.push(event);

    // Ограничиваем размер буфера
    if (this.eventBuffer.length > this.maxEventBufferSize) {
      this.eventBuffer.shift();
    }
  }

  /**
   * Получение метрик персонажа
   */
  getCharacterMetrics(characterId: number): CharacterMetrics | null {
    return this.characterMetrics.get(characterId) || null;
  }

  /**
   * Получение всех метрик персонажей
   */
  getAllCharacterMetrics(): CharacterMetrics[] {
    return Array.from(this.characterMetrics.values());
  }

  /**
   * Получение системных метрик
   */
  getSystemMetrics(): SystemMetrics {
    const now = new Date();
    const uptimeSeconds = Math.floor((now.getTime() - this.systemStartTime.getTime()) / 1000);

    const allMetrics = Array.from(this.characterMetrics.values());
    const activeCharacters = allMetrics.filter(m => {
      const timeSinceActivity = now.getTime() - m.lastActivity.getTime();
      return timeSinceActivity < 60 * 60 * 1000; // активен если был активен в последний час
    });

    const totalMessages = allMetrics.reduce((sum, m) => sum + m.messageCount, 0);
    const averageMessageCount = allMetrics.length > 0 ? totalMessages / allMetrics.length : 0;

    // Расчет производительности планировщика
    const averageExecutionTime =
      this.schedulerExecutionTimes.length > 0
        ? this.schedulerExecutionTimes.reduce((sum, time) => sum + time, 0) /
          this.schedulerExecutionTimes.length
        : 0;

    const successRate =
      this.schedulerExecutions > 0
        ? (this.schedulerSuccessCount / this.schedulerExecutions) * 100
        : 100;

    const lastExecutionTime =
      this.schedulerExecutionTimes.length > 0
        ? this.schedulerExecutionTimes[this.schedulerExecutionTimes.length - 1]
        : 0;

    // Простая эмуляция использования памяти
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    return {
      totalCharacters: allMetrics.length,
      activeCharacters: activeCharacters.length,
      inactiveCharacters: allMetrics.length - activeCharacters.length,
      averageMessageCount,
      totalEmotionalStateChanges: this.totalEmotionalStateChanges,
      totalMotivationExecutions: this.totalMotivationExecutions,
      totalErrors: this.totalErrors,
      systemUptime: uptimeSeconds,
      memoryUsage: {
        used: usedMemory,
        total: totalMemory,
        percentage: memoryPercentage,
      },
      schedulerPerformance: {
        averageExecutionTime,
        successRate,
        lastExecutionTime,
      },
    };
  }

  /**
   * Получение событий за период
   */
  getEventsInPeriod(startTime: Date, endTime: Date): MonitoringEvent[] {
    return this.eventBuffer.filter(
      event => event.timestamp >= startTime && event.timestamp <= endTime,
    );
  }

  /**
   * Получение событий персонажа
   */
  getCharacterEvents(characterId: number, limit: number = 50): MonitoringEvent[] {
    return this.eventBuffer.filter(event => event.characterId === characterId).slice(-limit);
  }

  /**
   * Cron задача для генерации отчетов каждый час
   */
  @Cron(CronExpression.EVERY_HOUR)
  async generateHourlyReport(): Promise<void> {
    return this.withErrorHandling('генерации часового отчета мониторинга', async () => {
      const systemMetrics = this.getSystemMetrics();

      this.logInfo('Часовой отчет мониторинга', {
        totalCharacters: systemMetrics.totalCharacters,
        activeCharacters: systemMetrics.activeCharacters,
        totalMessages: systemMetrics.averageMessageCount * systemMetrics.totalCharacters,
        emotionalChanges: systemMetrics.totalEmotionalStateChanges,
        motivationExecutions: systemMetrics.totalMotivationExecutions,
        errors: systemMetrics.totalErrors,
        schedulerSuccessRate: systemMetrics.schedulerPerformance.successRate.toFixed(1) + '%',
        memoryUsage: systemMetrics.memoryUsage.percentage.toFixed(1) + '%',
        uptime: Math.round(systemMetrics.systemUptime / 3600) + 'h',
      });

      // Эмитируем событие с отчетом
      this.eventEmitter.emit('monitoring.hourly_report', {
        systemMetrics,
        characterMetrics: this.getAllCharacterMetrics(),
        timestamp: new Date(),
      });
    });
  }

  /**
   * Генерация финального отчета при остановке
   */
  private async generateFinalReport(): Promise<void> {
    try {
      const systemMetrics = this.getSystemMetrics();

      this.logInfo('Финальный отчет мониторинга', {
        totalCharacters: systemMetrics.totalCharacters,
        totalMessages: Math.round(
          systemMetrics.averageMessageCount * systemMetrics.totalCharacters,
        ),
        totalEmotionalChanges: systemMetrics.totalEmotionalStateChanges,
        totalMotivationExecutions: systemMetrics.totalMotivationExecutions,
        totalErrors: systemMetrics.totalErrors,
        schedulerExecutions: this.schedulerExecutions,
        schedulerSuccessRate: systemMetrics.schedulerPerformance.successRate.toFixed(1) + '%',
        totalUptime: Math.round(systemMetrics.systemUptime / 3600) + ' часов',
        eventsProcessed: this.eventBuffer.length,
      });
    } catch (error) {
      this.logError('Ошибка генерации финального отчета', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Сброс метрик (для тестов)
   */
  resetMetrics(): void {
    this.characterMetrics.clear();
    this.totalEmotionalStateChanges = 0;
    this.totalMotivationExecutions = 0;
    this.totalErrors = 0;
    this.schedulerExecutions = 0;
    this.schedulerExecutionTimes = [];
    this.schedulerSuccessCount = 0;
    this.eventBuffer = [];
    this.systemStartTime = new Date();
  }
}

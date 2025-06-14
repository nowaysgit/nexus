import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ErrorHandlingService } from '../common/utils/error-handling/error-handling.service';
import { LogService } from '../logging/log.service';
import {
  MessageContext,
  MessageProcessingResult,
} from '../common/interfaces/message-processor.interface';

/**
 * Статус сообщения в очереди
 */
export enum MessageQueueStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Приоритет сообщения в очереди
 */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 5,
  HIGH = 10,
  URGENT = 20,
}

/**
 * Типы источников сообщений для приоритизации
 */
export enum MessageSourcePriority {
  API = 15, // Высокий приоритет для API-запросов
  TELEGRAM = 10, // Средний приоритет для Telegram
  SYSTEM = 8, // Приоритет для системных сообщений
  BACKGROUND = 3, // Низкий приоритет для фоновых задач
}

/**
 * Параметры для постановки сообщения в очередь
 */
export interface EnqueueMessageOptions {
  /** Приоритет сообщения */
  priority?: MessagePriority;
  /** Таймаут обработки сообщения (в мс) */
  timeout?: number;
  /** Максимальное количество повторных попыток */
  maxRetries?: number;
  /** Дополнительные метаданные для обработки сообщения */
  metadata?: Record<string, unknown>;
}

/**
 * Конфигурация сервиса очереди сообщений
 */
export interface MessageQueueConfig {
  /** Максимальное количество одновременно обрабатываемых сообщений */
  maxConcurrent?: number;
  /** Интервал проверки очереди (в мс) */
  pollInterval?: number;
  /** Таймаут по умолчанию для обработки сообщения (в мс) */
  defaultTimeout?: number;
  /** Максимальное количество повторных попыток по умолчанию */
  defaultMaxRetries?: number;
  /** Максимальный размер истории обработанных сообщений */
  historyLimit?: number;
  /** Включить автоматический запуск обработчика очереди */
  autoStart?: boolean;
}

/**
 * Информация о сообщении в очереди
 */
export interface QueuedMessage<T = unknown> {
  /** Уникальный идентификатор сообщения в очереди */
  id: string;
  /** Контекст сообщения */
  messageContext: MessageContext;
  /** Приоритет обработки сообщения */
  priority: MessagePriority;
  /** Функция обработки сообщения */
  processor: (message: MessageContext) => Promise<MessageProcessingResult<T>>;
  /** Дата и время постановки в очередь */
  queuedAt: Date;
  /** Дата и время начала обработки */
  startedAt?: Date;
  /** Дата и время завершения обработки */
  completedAt?: Date;
  /** Текущий статус */
  status: MessageQueueStatus;
  /** Результат обработки */
  result?: MessageProcessingResult<T>;
  /** Ошибка, если обработка завершилась неудачно */
  error?: Error;
  /** Таймаут обработки сообщения (в мс) */
  timeout?: number;
  /** Количество выполненных повторных попыток */
  retries?: number;
  /** Максимальное количество повторных попыток */
  maxRetries?: number;
  /** Дополнительные метаданные для обработки сообщения */
  metadata?: Record<string, unknown>;
}

/**
 * Упрощенный сервис очереди сообщений
 */
@Injectable()
export class MessageQueueService implements OnModuleDestroy {
  // Состояние очереди
  private queue: QueuedMessage[] = [];
  private messageCounter = 0;

  // Состояние обработчика
  private processingCount = 0;
  private isRunning = false;
  private processorInterval: NodeJS.Timeout | null = null;

  // Конфигурация по умолчанию
  private readonly config: Required<MessageQueueConfig> = {
    maxConcurrent: 5,
    pollInterval: 100,
    defaultTimeout: 30000,
    defaultMaxRetries: 2,
    historyLimit: 100,
    autoStart: true,
  };

  constructor(
    private readonly errorHandlingService: ErrorHandlingService,
    private readonly logService: LogService,
  ) {
    // Используем конфигурацию по умолчанию

    this.logService.log(`Упрощенный сервис очереди сообщений инициализирован`, {
      maxConcurrent: this.config.maxConcurrent,
      pollInterval: this.config.pollInterval,
    });

    // Автоматический запуск обработчика очереди
    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Добавляет сообщение в очередь для обработки
   */
  async enqueue<T>(
    messageContext: MessageContext,
    processor: (message: MessageContext) => Promise<MessageProcessingResult<T>>,
    options: EnqueueMessageOptions = {},
  ): Promise<MessageProcessingResult<T>> {
    const messageId = await this.enqueueMessage(messageContext, processor, options);

    this.logService.debug('Сообщение добавлено в очередь', {
      messageId,
      type: messageContext.type,
      source: messageContext.source,
      priority: options.priority,
    });

    // Возвращаем Promise, который разрешится когда сообщение будет обработано
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const message = this.findMessage(messageId);
        if (!message) {
          reject(new Error(`Сообщение ${messageId} не найдено в очереди`));
          return;
        }

        if (message.status === MessageQueueStatus.COMPLETED) {
          const result = (message.result as MessageProcessingResult<T>) ||
            ({
              success: true,
              handled: true,
              context: message.messageContext,
            } as MessageProcessingResult<T>);
          
          // Удаляем сообщение только после получения результата
          this.removeMessage(messageId);
          resolve(result);
        } else if (message.status === MessageQueueStatus.FAILED) {
          const error = message.error || new Error('Неизвестная ошибка при обработке сообщения');
          // Удаляем сообщение только после получения ошибки
          this.removeMessage(messageId);
          reject(error);
        } else {
          // Сообщение еще обрабатывается, проверим позже
          setTimeout(checkStatus, 100);
        }
      };

      // Начинаем проверку статуса
      setTimeout(checkStatus, 10);
    });
  }

  /**
   * Внутренний метод для добавления сообщения в очередь
   */
  private async enqueueMessage<T>(
    messageContext: MessageContext,
    processor: (message: MessageContext) => Promise<MessageProcessingResult<T>>,
    options: EnqueueMessageOptions = {},
  ): Promise<string> {
    const messageId = `msg_${++this.messageCounter}_${Date.now()}`;
    const priority = options.priority || this.getDefaultPriorityBySource(messageContext.source);

    const queuedMessage: QueuedMessage<T> = {
      id: messageId,
      messageContext,
      priority,
      processor,
      queuedAt: new Date(),
      status: MessageQueueStatus.QUEUED,
      timeout: options.timeout || this.config.defaultTimeout,
      maxRetries: options.maxRetries || this.config.defaultMaxRetries,
      retries: 0,
      metadata: options.metadata,
    };

    this.queue.push(queuedMessage);
    this.sortQueue();

    this.logService.debug(`Сообщение добавлено в очередь`, {
      messageId,
      priority,
      queueLength: this.queue.length,
    });

    return messageId;
  }

  /**
   * Запускает обработчик очереди
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.logService.log('Обработчик очереди сообщений запущен');

    const processQueueSafely = () => {
      this.processQueue().catch(error => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logService.error('Ошибка при обработке очереди', {
          error: errorMessage,
        });
      });
    };

    this.processorInterval = setInterval(processQueueSafely, this.config.pollInterval);
  }

  /**
   * Останавливает обработчик очереди
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.processorInterval) {
      clearInterval(this.processorInterval);
      this.processorInterval = null;
    }

    this.logService.log('Обработчик очереди сообщений остановлен', {
      remainingMessages: this.queue.length,
      processingCount: this.processingCount,
    });
  }

  /**
   * Обрабатывает очередь сообщений
   */
  private async processQueue(): Promise<void> {
    if (this.processingCount >= this.config.maxConcurrent) {
      return; // Достигнут лимит одновременной обработки
    }

    const message = this.getNextMessage();
    if (!message) {
      return; // Нет сообщений для обработки
    }

    this.processingCount++;
    message.status = MessageQueueStatus.PROCESSING;
    message.startedAt = new Date();

    try {
      this.logService.debug(`Начинаем обработку сообщения`, {
        messageId: message.id,
        type: message.messageContext.type,
      });

      const result = await message.processor(message.messageContext);
      this.handleMessageSuccess(message, result);
    } catch (error) {
      this.handleMessageFailure(message, error);
    } finally {
      this.processingCount--;
    }
  }

  /**
   * Получает следующее сообщение для обработки
   */
  private getNextMessage(): QueuedMessage | null {
    return this.queue.find(msg => msg.status === MessageQueueStatus.QUEUED) || null;
  }

  /**
   * Обрабатывает успешное выполнение сообщения
   */
  private handleMessageSuccess<T>(
    message: QueuedMessage<T>,
    result: MessageProcessingResult<T>,
  ): void {
    this.markMessageCompleted(message.id, result);

    if (result.success) {
      this.logService.log('Сообщение успешно обработано', {
        messageId: message.id,
        processingTime: Date.now() - (message.startedAt?.getTime() || 0),
      });
    } else {
      this.logService.warn('Сообщение обработано с предупреждениями', {
        messageId: message.id,
        processingTime: Date.now() - (message.startedAt?.getTime() || 0),
      });
    }

    // Сообщение будет удалено из очереди в методе enqueue после получения результата
  }

  /**
   * Обрабатывает неудачное выполнение сообщения
   */
  private handleMessageFailure<T>(message: QueuedMessage<T>, error: unknown): void {
    const errorObj = error instanceof Error ? error : new Error(JSON.stringify(error));

    this.logService.error('Ошибка при обработке сообщения', {
      messageId: message.id,
      error: errorObj.message,
      processingTime: Date.now() - (message.startedAt?.getTime() || 0),
      retries: message.retries || 0,
    });

    // Проверяем, нужна ли повторная попытка
    if (this.shouldRetryMessage(message.id)) {
      this.retryMessage(message.id);
      this.logService.log('Сообщение возвращено в очередь для повторной попытки', {
        messageId: message.id,
      });
    } else {
      this.markMessageFailed(message.id, errorObj);
      this.logService.error('Сообщение окончательно не обработано после всех попыток', {
        messageId: message.id,
      });
      // Сообщение будет удалено из очереди в методе enqueue после получения ошибки
    }
  }

  /**
   * Отмечает сообщение как завершенное
   */
  private markMessageCompleted<T>(messageId: string, result: MessageProcessingResult<T>): void {
    const message = this.findMessage(messageId);
    if (message) {
      message.status = MessageQueueStatus.COMPLETED;
      message.completedAt = new Date();
      message.result = result;
    }
  }

  /**
   * Отмечает сообщение как неудачное
   */
  private markMessageFailed(messageId: string, error: Error): void {
    const message = this.findMessage(messageId);
    if (message) {
      message.status = MessageQueueStatus.FAILED;
      message.completedAt = new Date();
      message.error = error;
    }
  }

  /**
   * Проверяет, нужна ли повторная попытка для сообщения
   */
  private shouldRetryMessage(messageId: string): boolean {
    const message = this.findMessage(messageId);
    if (!message) return false;

    const maxRetries = message.maxRetries || this.config.defaultMaxRetries;
    return (message.retries || 0) < maxRetries;
  }

  /**
   * Увеличивает счетчик повторных попыток и возвращает сообщение в очередь
   */
  private retryMessage(messageId: string): void {
    const message = this.findMessage(messageId);
    if (message) {
      message.retries = (message.retries || 0) + 1;
      message.status = MessageQueueStatus.QUEUED;
      message.startedAt = undefined;
      this.sortQueue();

      this.logService.debug(`Сообщение возвращено в очередь для повторной попытки`, {
        messageId,
        retries: message.retries,
        maxRetries: message.maxRetries,
      });
    }
  }

  /**
   * Удаляет сообщение из очереди
   */
  private removeMessage(messageId: string): void {
    const index = this.queue.findIndex(msg => msg.id === messageId);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  /**
   * Получает сообщение по ID
   */
  findMessage(messageId: string): QueuedMessage | undefined {
    return this.queue.find(msg => msg.id === messageId);
  }

  /**
   * Получает все сообщения в очереди
   */
  getAllMessages(): QueuedMessage[] {
    return [...this.queue];
  }

  /**
   * Получает сообщения по статусу
   */
  getMessagesByStatus(status: MessageQueueStatus): QueuedMessage[] {
    return this.queue.filter(msg => msg.status === status);
  }

  /**
   * Очищает очередь
   */
  clearQueue(onlyQueued: boolean = true): void {
    if (onlyQueued) {
      this.queue = this.queue.filter(msg => msg.status !== MessageQueueStatus.QUEUED);
    } else {
      this.queue = [];
    }

    this.logService.log(`Очередь очищена`, {
      onlyQueued,
      remainingMessages: this.queue.length,
    });
  }

  /**
   * Определяет приоритет по умолчанию на основе источника сообщения
   */
  private getDefaultPriorityBySource(source: string): MessagePriority {
    switch (source.toLowerCase()) {
      case 'api':
        return MessagePriority.HIGH;
      case 'telegram':
        return MessagePriority.NORMAL;
      case 'system':
        return MessagePriority.NORMAL;
      case 'background':
        return MessagePriority.LOW;
      default:
        return MessagePriority.NORMAL;
    }
  }

  /**
   * Сортирует очередь по приоритету (высокий приоритет первым)
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // Сначала по статусу (QUEUED сообщения первыми)
      if (a.status !== b.status) {
        const statusOrder = {
          [MessageQueueStatus.QUEUED]: 0,
          [MessageQueueStatus.PROCESSING]: 1,
          [MessageQueueStatus.COMPLETED]: 2,
          [MessageQueueStatus.FAILED]: 3,
        };
        return statusOrder[a.status] - statusOrder[b.status];
      }

      // Затем по приоритету (высокий приоритет первым)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // И наконец по времени добавления (старые первыми)
      return a.queuedAt.getTime() - b.queuedAt.getTime();
    });
  }

  /**
   * Завершение работы модуля
   */
  async onModuleDestroy(): Promise<void> {
    this.logService.log('Завершение работы сервиса очереди сообщений');
    this.stop();

    // Ждем завершения обработки текущих сообщений
    const maxWaitTime = 5000; // 5 секунд
    const startTime = Date.now();

    while (this.processingCount > 0 && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.processingCount > 0) {
      this.logService.warn(
        `Принудительное завершение с ${this.processingCount} активными сообщениями`,
      );
    }
  }

  /**
   * Получает статистику очереди
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      processingCount: this.processingCount,
      isRunning: this.isRunning,
      messagesByStatus: {
        queued: this.getMessagesByStatus(MessageQueueStatus.QUEUED).length,
        processing: this.getMessagesByStatus(MessageQueueStatus.PROCESSING).length,
        completed: this.getMessagesByStatus(MessageQueueStatus.COMPLETED).length,
        failed: this.getMessagesByStatus(MessageQueueStatus.FAILED).length,
      },
    };
  }

  /**
   * Получает конфигурацию
   */
  getConfig(): Required<MessageQueueConfig> {
    return { ...this.config };
  }

  /**
   * Обновляет конфигурацию
   */
  updateConfig(newConfig: Partial<MessageQueueConfig>): void {
    Object.assign(this.config, newConfig);
    this.logService.log('Конфигурация сервиса очереди обновлена', newConfig);
  }
}

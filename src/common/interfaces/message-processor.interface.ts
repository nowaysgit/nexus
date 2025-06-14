/**
 * Интерфейс обработчика сообщений
 */
export interface MessageHandler<TContext, TResult = any> {
  /**
   * Проверяет, может ли обработчик обработать сообщение
   * @param context Контекст сообщения
   * @returns Promise<boolean> | boolean - Может ли обработчик обработать сообщение
   */
  canHandle(context: TContext): Promise<boolean> | boolean;

  /**
   * Обрабатывает сообщение
   * @param context Контекст сообщения
   * @returns Promise<TResult> - Результат обработки
   */
  handle(context: TContext): Promise<TResult>;

  /**
   * Возвращает приоритет обработчика (опционально)
   * Обработчики с большим приоритетом будут вызваны раньше
   * @returns number - Приоритет (по умолчанию 0)
   */
  getPriority?(): number;
}

/**
 * Контекст сообщения для обработки и валидации
 */
export interface MessageContext {
  /** Уникальный идентификатор сообщения */
  id: string;

  /** Тип сообщения */
  type: string;

  /** Источник сообщения */
  source: string;

  /** Содержимое сообщения */
  content?: string;

  /** Метаданные сообщения */
  metadata?: Record<string, any>;

  /** Временная метка создания */
  timestamp?: Date;

  /** Дата создания сообщения */
  createdAt?: Date;

  /** Идентификатор пользователя */
  userId?: string;

  /** Идентификатор чата/диалога */
  chatId?: string;
}

/**
 * Результат обработки сообщения
 */
export interface MessageProcessingResult<T = any> {
  /** Успешность обработки */
  success: boolean;

  /** Было ли сообщение обработано */
  handled: boolean;

  /** Результат обработки (если применимо) */
  result?: T;

  /** Ошибка (если произошла) */
  error?: Error;

  /** Контекст сообщения */
  context: MessageContext;

  /** Дополнительные данные */
  metadata?: Record<string, any>;
}

/**
 * Интерфейс для обработчика сообщений
 */
export interface MessageProcessor {
  /** Обработать сообщение */
  processMessage(context: MessageContext): Promise<any>;

  /** Проверить, может ли обработчик обработать данное сообщение */
  canProcess(context: MessageContext): boolean;
}

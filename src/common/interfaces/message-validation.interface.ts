import { MessageContext } from './message-processor.interface';

/**
 * Ошибка валидации
 */
export interface ValidationError {
  /** Сообщение об ошибке */
  message: string;

  /** Поле, в котором произошла ошибка */
  field: string;

  /** Код ошибки */
  code?: string;

  /** Дополнительные данные */
  [key: string]: any;
}

/**
 * Результат валидации
 */
export interface ValidationResult {
  /** Валидно ли сообщение */
  isValid: boolean;

  /** Список ошибок валидации */
  errors?: ValidationError[];

  /** Дополнительные данные */
  metadata?: Record<string, any>;
}

/**
 * Правило валидации
 */
export interface ValidationRule {
  /** Название правила */
  name: string;

  /** Описание правила */
  description?: string;

  /** Функция валидации */
  validate: (context: MessageContext) => Promise<ValidationResult> | ValidationResult;

  /** Приоритет правила (чем меньше, тем выше приоритет) */
  priority?: number;

  /** Активно ли правило */
  enabled?: boolean;
}

/**
 * Трансформер сообщений
 */
export interface MessageTransformer<TInput = MessageContext, TOutput = MessageContext> {
  /** Название трансформера */
  name: string;

  /** Описание трансформера */
  description?: string;

  /** Функция трансформации */
  transform: (context: TInput) => Promise<TOutput> | TOutput;

  /** Приоритет трансформера */
  priority?: number;

  /** Активен ли трансформер */
  enabled?: boolean;
}

/**
 * Конфигурация валидации
 */
export interface ValidationConfig {
  /** Правила валидации */
  rules: ValidationRule[];

  /** Трансформеры сообщений */
  transformers?: MessageTransformer[];

  /** Остановить валидацию при первой ошибке */
  stopOnFirstError?: boolean;

  /** Максимальное количество ошибок */
  maxErrors?: number;

  /** Таймаут валидации в миллисекундах */
  timeout?: number;
}

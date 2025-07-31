import { MessageContext } from './message-processor.interface';

/**
 * Результат валидации
 */
export interface ValidationResult {
  /**
   * Успешна ли валидация
   */
  isValid: boolean;

  /**
   * Список ошибок валидации
   */
  errors?: ValidationError[];

  /**
   * Проверенные данные с преобразованием
   */
  validatedData?: Record<string, any>;

  /**
   * Преобразованное/нормализованное сообщение (если валидация успешна)
   */
  transformedMessage?: MessageContext;
}

/**
 * Ошибка валидации
 */
export interface ValidationError {
  /**
   * Поле с ошибкой
   */
  field: string;

  /**
   * Сообщение об ошибке
   */
  message: string;

  /**
   * Код ошибки
   */
  code?: string;

  /**
   * Значение, которое вызвало ошибку
   */
  value?: unknown;

  /**
   * Вложенные ошибки (для объектных полей)
   */
  children?: ValidationError[];
}

/**
 * Опции валидации
 */
export interface ValidationOptions {
  /**
   * Убирать ли поля, не указанные в схеме
   */
  whitelist?: boolean;

  /**
   * Выбрасывать ли ошибку при наличии лишних полей
   */
  forbidNonWhitelisted?: boolean;

  /**
   * Выполнять ли преобразование типов
   */
  transform?: boolean;

  /**
   * Пропускать ли null значения
   */
  skipNullProperties?: boolean;

  /**
   * Пропускать ли undefined значения
   */
  skipUndefinedProperties?: boolean;

  /**
   * Пропускать ли пустые значения
   */
  skipEmptyString?: boolean;
}

/**
 * Правило валидации сообщения
 */
export interface ValidationRule<T extends MessageContext = MessageContext> {
  /** Имя правила */
  name: string;

  /** Валидирует сообщение */
  validate(message: T): Promise<ValidationResult> | ValidationResult;

  /** Приоритет правила (правила с более высоким приоритетом выполняются раньше) */
  priority?: number;
}

/**
 * Функция трансформации сообщения
 */
export type MessageTransformer<TInput extends MessageContext, TOutput extends MessageContext> = (
  message: TInput,
) => Promise<TOutput> | TOutput;

/**
 * Интерфейс шаблона сообщения
 */
export interface MessageTemplate {
  /** Тип сообщения */
  type: string;

  /** Схема валидации */
  schema: Record<string, any>;

  /** Трансформер для преобразования в стандартный формат */
  transformer?: MessageTransformer<any, MessageContext>;
}

/**
 * Интерфейс сервиса валидации
 */
export interface IValidationService {
  /**
   * Валидирует объект по схеме или классу DTO
   * @param schema Схема валидации или класс DTO
   * @param value Объект для валидации
   * @param options Опции валидации
   * @returns Результат валидации
   */
  validate(
    schema: object | (new (...args: unknown[]) => object),
    value: Record<string, unknown>,
    options?: ValidationOptions,
  ): Promise<ValidationResult>;

  /**
   * Валидирует массив объектов
   * @param schema Схема валидации или класс DTO
   * @param values Массив объектов для валидации
   * @param options Опции валидации
   * @returns Массив результатов валидации
   */
  validateMany(
    schema: object | (new (...args: unknown[]) => object),
    values: Array<Record<string, unknown>>,
    options?: ValidationOptions,
  ): Promise<ValidationResult[]>;

  /**
   * Валидирует значение с помощью функции валидации
   * @param validationFn Функция валидации
   * @param value Значение для валидации
   * @returns Результат валидации
   */
  validateWithFn(
    validationFn: (value: unknown) => boolean | string | Error | Promise<boolean | string | Error>,
    value: unknown,
  ): Promise<ValidationResult>;

  /**
   * Валидирует сообщение пользователя
   * @param message Текст сообщения
   * @returns Результат валидации с очищенным сообщением и предупреждениями
   */
  validateMessage(message: string): Promise<{
    isValid: boolean;
    sanitizedMessage?: string;
    errors?: string[];
    warnings?: string[];
  }>;

  /**
   * Валидирует данные персонажа
   * @param characterData Данные персонажа
   * @returns Результат валидации
   */
  validateCharacterData(characterData: Record<string, unknown>): Promise<ValidationResult>;

  /**
   * Валидирует пользовательский ввод
   * @param input Пользовательский ввод
   * @returns Результат валидации
   */
  validateUserInput(input: Record<string, unknown>): Promise<ValidationResult>;

  /**
   * Очищает пользовательский ввод от потенциально опасных элементов
   * @param input Строка для очистки
   * @returns Очищенная строка
   */
  sanitizeInput(input: string): string;

  /**
   * Валидирует API запрос
   * @param request Объект запроса
   * @returns Результат валидации
   */
  validateApiRequest(request: Record<string, unknown>): Promise<{
    isValid: boolean;
    validatedRequest?: Record<string, unknown>;
    errors?: ValidationError[];
  }>;

  /**
   * Валидирует конфигурационные настройки
   * @param config Объект конфигурации
   * @returns Результат валидации с предупреждениями
   */
  validateConfiguration(config: Record<string, unknown>): Promise<{
    isValid: boolean;
    validatedConfig?: Record<string, unknown>;
    errors?: ValidationError[];
    warnings?: string[];
  }>;

  /**
   * Возвращает правила валидации
   * @returns Объект с правилами валидации
   */
  getValidationRules(): Record<string, unknown>;
}

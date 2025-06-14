/**
 * Модуль определяет основные интерфейсы для взаимодействия с OpenAI API
 * Перенесено из openai модуля для использования в LLM системе
 */

/**
 * Приоритет задачи
 */
export enum TaskPriority {
  LOW = 0,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 20,
}

/**
 * Формат ответа от OpenAI API
 */
export interface ResponseFormat {
  /** Тип формата ответа */
  type: 'text' | 'json_object';
}

/**
 * Параметры запроса к OpenAI API
 */
export interface OpenAIRequestParams {
  /** Температура генерации (0-1) */
  temperature: number;

  /** Максимальное количество токенов для ответа */
  max_tokens: number;

  /** Нужно ли распарсить ответ как JSON */
  parseJson: boolean;

  /** Формат ответа (для новых версий API) */
  response_format?: ResponseFormat;

  /** Сид для детерминированной генерации */
  seed?: number;

  /** Параметр top_p для генерации */
  top_p?: number;

  /** Штраф частоты повторения */
  frequency_penalty?: number;

  /** Штраф присутствия */
  presence_penalty?: number;
}

/**
 * Опции для выполнения запроса
 */
export interface OpenAIRequestOptions extends Partial<OpenAIRequestParams> {
  /** Количество повторных попыток при неудаче */
  retries?: number;

  /** Использовать ли кэширование */
  useCache?: boolean;

  /** Время жизни записи в кэше (в мс) */
  cacheTTL?: number;

  /** Приоритет задачи в очереди */
  priority?: TaskPriority;

  /** Эндпоинт API */
  endpoint?: string;

  /** Таймаут выполнения запроса в мс */
  timeout?: number;

  /** Модель для использования */
  model?: string;
}

/**
 * Информация о выполнении запроса
 */
export interface OpenAIRequestInfo {
  /** ID запроса */
  requestId: string;

  /** Использовалась ли версия из кэша */
  fromCache: boolean;

  /** Время выполнения запроса в мс */
  executionTime: number;

  /** Количество токенов в запросе */
  promptTokens?: number;

  /** Количество токенов в ответе */
  completionTokens?: number;

  /** Общее количество токенов */
  totalTokens?: number;

  /** Модель, которая использовалась */
  model: string;

  /** ID запроса в OpenAI */
  openaiId?: string;
}

/**
 * Типы сообщений для чата
 */
export enum MessageRole {
  /** Системное сообщение */
  SYSTEM = 'system',

  /** Сообщение от пользователя */
  USER = 'user',

  /** Сообщение от ассистента */
  ASSISTANT = 'assistant',

  /** Сообщение от функции */
  FUNCTION = 'function',

  /** Сообщение от инструмента */
  TOOL = 'tool',
}

/**
 * Интерфейс сообщения чата для OpenAI API
 */
export interface ChatMessage {
  role: string;
  content: string;
  name?: string;
}

/**
 * Результат генерации текста
 */
export interface TextGenerationResult {
  /** Сгенерированный текст */
  text: string;

  /** Информация о запросе */
  requestInfo?: OpenAIRequestInfo;
}

/**
 * Результат генерации JSON
 */
export interface JSONGenerationResult<T = Record<string, unknown>> {
  /** Сгенерированные данные */
  data: T;

  /** Сырой текст (в случае ошибки парсинга) */
  rawText?: string;

  /** Информация о запросе */
  requestInfo?: OpenAIRequestInfo;
}

/**
 * Элемент воспоминания персонажа
 */
export interface MemoryItem {
  /** Содержание воспоминания */
  content: string;

  /** Тип воспоминания (event, conversation, user_preference, promise, conflict) */
  type: string;

  /** Важность воспоминания (low, medium, high, critical) */
  importance: string;
}

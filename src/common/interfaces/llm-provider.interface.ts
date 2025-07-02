/**
 * Общие интерфейсы для взаимодействия с LLM провайдерами
 * Поддерживает OpenAI, Llama и другие модели
 */

/**
 * Типы поддерживаемых LLM провайдеров
 */
export enum LLMProviderType {
  OPENAI = 'openai',
  LLAMA = 'llama',
  CLAUDE = 'claude',
  GEMINI = 'gemini',
  CUSTOM = 'custom',
}

/**
 * Роли сообщений в диалоге
 */
export enum LLMMessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  FUNCTION = 'function',
  TOOL = 'tool',
}

/**
 * Сообщение для LLM
 */
export interface ILLMMessage {
  role: LLMMessageRole;
  content: string;
  name?: string;
}

/**
 * Параметры запроса к LLM
 */
export interface ILLMRequestParams {
  /** Модель для использования */
  model?: string;

  /** Температура генерации (0-1) */
  temperature?: number;

  /** Максимальное количество токенов для ответа */
  maxTokens?: number;

  /** Нужно ли парсить ответ как JSON */
  parseJson?: boolean;

  /** Параметр top_p для генерации */
  topP?: number;

  /** Штраф частоты повторения */
  frequencyPenalty?: number;

  /** Штраф присутствия */
  presencePenalty?: number;

  /** Сид для детерминированной генерации */
  seed?: number;
}

/**
 * Опции выполнения запроса
 */
export interface ILLMRequestOptions extends ILLMRequestParams {
  /** Количество повторных попыток при неудаче */
  retries?: number;

  /** Использовать ли кэширование */
  useCache?: boolean;

  /** Время жизни записи в кэше (в мс) */
  cacheTTL?: number;

  /** Таймаут выполнения запроса в мс */
  timeout?: number;
}

/**
 * Информация о выполнении запроса
 */
export interface ILLMRequestInfo {
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

  /** Стоимость запроса */
  cost?: number;
}

/**
 * Результат генерации текста
 */
export interface ILLMTextResult {
  /** Сгенерированный текст */
  text: string;

  /** Информация о запросе */
  requestInfo?: ILLMRequestInfo;
}

/**
 * Результат генерации JSON
 */
export interface ILLMJsonResult<T = Record<string, unknown>> {
  /** Сгенерированные данные */
  data: T;

  /** Сырой текст (в случае ошибки парсинга) */
  rawText?: string;

  /** Информация о запросе */
  requestInfo?: ILLMRequestInfo;
}

/**
 * Колбэки для потокового вывода
 */
export interface ILLMStreamCallbacks {
  onStart?: () => void;
  onToken?: (token: string) => void;
  onProgress?: (fullText: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Основной интерфейс LLM провайдера
 */
export interface ILLMProvider {
  /** Тип провайдера */
  readonly providerType: LLMProviderType;

  /** Название провайдера */
  readonly providerName: string;

  /** Проверка доступности провайдера */
  checkAvailability(): Promise<boolean>;

  /** Генерация текста */
  generateText(messages: ILLMMessage[], options?: ILLMRequestOptions): Promise<ILLMTextResult>;

  /** Генерация JSON */
  generateJSON<T = Record<string, unknown>>(
    messages: ILLMMessage[],
    options?: ILLMRequestOptions,
  ): Promise<ILLMJsonResult<T>>;

  /** Потоковая генерация текста */
  generateTextStream(
    messages: ILLMMessage[],
    callbacks: ILLMStreamCallbacks,
    options?: ILLMRequestOptions,
  ): Promise<void>;

  /** Оценка количества токенов */
  estimateTokens(text: string): number;

  /** Получение информации о провайдере */
  getProviderInfo(): {
    type: LLMProviderType;
    name: string;
    models: string[];
    features: string[];
  };

  /** Генерация векторного представления текста */
  generateEmbedding(text: string): Promise<number[]>;
}

/**
 * Интерфейс менеджера LLM провайдеров
 */
export interface ILLMProviderManager {
  /** Регистрация провайдера */
  registerProvider(provider: ILLMProvider): void;

  /** Получение активного провайдера */
  getActiveProvider(): ILLMProvider;

  /** Получение провайдера по типу */
  getProvider(type: LLMProviderType): ILLMProvider | undefined;

  /** Получение списка всех провайдеров */
  getAllProviders(): ILLMProvider[];

  /** Установка активного провайдера */
  setActiveProvider(type: LLMProviderType): void;
}

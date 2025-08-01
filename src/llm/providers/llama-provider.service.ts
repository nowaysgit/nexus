import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LogService } from '../../logging/log.service';
import axios, { AxiosInstance } from 'axios';
import {
  ILLMProvider,
  ILLMTextResult,
  ILLMJsonResult,
  ILLMMessage,
  ILLMRequestOptions,
  ILLMStreamCallbacks,
  LLMProviderType,
  LLMMessageRole,
  ILLMRequestInfo,
} from '../../common/interfaces/llm-provider.interface';

/**
 * Интерфейс для запроса к Ollama API
 */
interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_p?: number;
  };
  stream: boolean;
}

/**
 * Интерфейс для ответа от Ollama API
 */
interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Llama 3.2 провайдер для работы с Llama моделями
 * Реализует общий интерфейс ILLMProvider
 */
@Injectable()
export class LlamaProviderService implements ILLMProvider {
  readonly providerType = LLMProviderType.LLAMA;
  readonly providerName = 'Llama 3.2';

  private readonly httpClient: AxiosInstance;
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly timeout: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(LlamaProviderService.name);

    // Получаем конфигурацию Llama
    const llamaConfig = this.configService.get<{
      endpoint?: string;
      apiKey?: string;
      model?: string;
      timeout?: number;
    }>('llm.providers.llama');

    this.endpoint =
      llamaConfig?.endpoint || process.env.LLM_LLAMA_ENDPOINT || 'http://localhost:8080';
    this.apiKey = llamaConfig?.apiKey || process.env.LLM_LLAMA_API_KEY || '';
    this.defaultModel = llamaConfig?.model || process.env.LLM_LLAMA_MODEL || 'llama3.2:3b';
    this.timeout = llamaConfig?.timeout || 30000;

    // Инициализируем HTTP клиент
    this.httpClient = axios.create({
      baseURL: this.endpoint,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
    });

    this.logService.log('Llama провайдер инициализирован', {
      endpoint: this.endpoint,
      model: this.defaultModel,
      hasApiKey: !!this.apiKey,
      timeout: this.timeout,
    });
  }

  /**
   * Проверка доступности Llama API
   */
  async checkAvailability(): Promise<boolean> {
    try {
      // Отправляем тестовый запрос для проверки доступности API
      await this.httpClient.get('/api/tags');
      return true;
    } catch (error) {
      this.logService.warn('Ollama API недоступен', {
        error: error instanceof Error ? error.message : String(error),
        endpoint: this.endpoint,
      });
      return false;
    }
  }

  /**
   * Проверка здоровья Llama API
   */
  async checkHealth(): Promise<boolean> {
    return this.checkAvailability();
  }

  /**
   * Получение списка доступных моделей
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.httpClient.get<{
        models?: Array<{ name?: string; model?: string }>;
      }>('/api/tags');

      if (response.data?.models) {
        return response.data.models
          .map(model => model.name || model.model)
          .filter((name): name is string => typeof name === 'string');
      }

      // Возвращаем модели по умолчанию если API недоступен
      return ['llama3.2:3b', 'llama3.3:70b', 'llama3.1:8b'];
    } catch (error) {
      this.logService.warn('Не удалось получить список моделей от Llama API', {
        error: error instanceof Error ? error.message : String(error),
        endpoint: this.endpoint,
      });

      // Возвращаем модели по умолчанию
      return ['llama3.2:3b', 'llama3.3:70b', 'llama3.1:8b'];
    }
  }

  /**
   * Генерация текста через Llama - перегрузка для строки
   */
  async generateText(prompt: string, model?: string): Promise<string>;

  /**
   * Генерация текста через Llama - перегрузка для сообщений
   */
  async generateText(
    messages: ILLMMessage[],
    options?: ILLMRequestOptions,
  ): Promise<ILLMTextResult>;

  /**
   * Генерация текста через Llama - перегрузка с опциями
   */
  async generateText(prompt: string, model: string, options: ILLMRequestOptions): Promise<string>;

  /**
   * Генерация текста через Llama - основная реализация
   */
  async generateText(
    messagesOrPrompt: ILLMMessage[] | string,
    modelOrOptions?: string | ILLMRequestOptions,
    options?: ILLMRequestOptions,
  ): Promise<ILLMTextResult | string> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Определяем тип входных данных и подготавливаем сообщения
      let messages: ILLMMessage[];
      let finalOptions: ILLMRequestOptions;
      let returnAsString = false;

      if (typeof messagesOrPrompt === 'string') {
        // Вызов со строкой
        returnAsString = true;
        messages = [{ role: LLMMessageRole.USER, content: messagesOrPrompt }];

        if (typeof modelOrOptions === 'string') {
          // generateText(prompt, model) или generateText(prompt, model, options)
          finalOptions = options || {};
          finalOptions.model = modelOrOptions;
        } else {
          // generateText(prompt, options)
          finalOptions = modelOrOptions || {};
        }
      } else {
        // Вызов с массивом сообщений
        messages = messagesOrPrompt;
        finalOptions = (modelOrOptions as ILLMRequestOptions) || {};
      }

      this.logService.debug('Отправляем запрос к Llama API', {
        requestId,
        endpoint: this.endpoint,
        messagesCount: messages.length,
        options: finalOptions,
      });

      // Проверяем доступность API
      if (!this.endpoint || this.endpoint === 'http://localhost:8080') {
        this.logService.error(
          'Llama API endpoint не настроен, проверьте настройки LLM_LLAMA_ENDPOINT',
        );
        throw new Error('Llama API endpoint не настроен. Проверьте настройки LLM_LLAMA_ENDPOINT.');
      }

      // Подготавливаем запрос в формате Ollama
      const request: OllamaChatRequest = {
        model: finalOptions.model || this.defaultModel,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        options: {
          temperature: finalOptions.temperature ?? 0.7,
          num_predict: finalOptions.maxTokens ?? 1000,
          top_p: finalOptions.topP ?? 0.9,
        },
        stream: false,
      };

      // Выполняем запрос к Ollama API
      const response = await this.httpClient.post<OllamaChatResponse>('/api/chat', request);

      const executionTime = Date.now() - startTime;
      const responseContent: string = response.data?.message?.content || '';

      this.logService.debug('Получен ответ от Ollama API', {
        requestId,
        executionTime,
        promptEvalCount: response.data?.prompt_eval_count,
        evalCount: response.data?.eval_count,
        totalDuration: response.data?.total_duration,
      });

      // Возвращаем результат в нужном формате
      if (returnAsString) {
        return responseContent;
      }

      return {
        text: responseContent,
        requestInfo: {
          requestId,
          fromCache: false,
          executionTime,
          model: response.data?.model || request.model,
          promptTokens: response.data?.prompt_eval_count,
          completionTokens: response.data?.eval_count,
          totalTokens: (response.data?.prompt_eval_count || 0) + (response.data?.eval_count || 0),
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logService.error('Ошибка генерации текста через Llama', {
        requestId,
        executionTime,
        error: error instanceof Error ? error.message : String(error),
        messagesCount: Array.isArray(messagesOrPrompt) ? messagesOrPrompt.length : 1,
        options: modelOrOptions,
        endpoint: this.endpoint,
      });

      // Если API недоступен, выбрасываем ошибку
      if (
        axios.isAxiosError(error) &&
        (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')
      ) {
        this.logService.error('Llama API недоступен, проверьте настройки LLM_LLAMA_ENDPOINT');
        throw new Error('Llama API недоступен. Проверьте настройки LLM_LLAMA_ENDPOINT.');
      }

      throw error;
    }
  }

  /**
   * Генерация векторного представления (эмбеддинга) для текста через Llama.
   * Предполагается OpenAI-совместимый API.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.logService.debug('Отправляем запрос на генерацию эмбеддинга к Llama API', {
        requestId,
        endpoint: this.endpoint,
        textLength: text.length,
      });

      const request = {
        input: text,
        model: 'nomic-embed-text', // Это стандартная модель для эмбеддингов в llama.cpp, может потребоваться настройка
      };

      // Выполняем запрос к Llama API
      const response = await this.httpClient.post<{
        data: Array<{ embedding: number[] }>;
      }>('/v1/embeddings', request);

      const executionTime = Date.now() - startTime;
      const embedding = response.data.data[0]?.embedding;

      if (!embedding) {
        throw new Error('API не вернул эмбеддинг в ожидаемом формате.');
      }

      this.logService.debug('Получен эмбеддинг от Llama API', {
        requestId,
        executionTime,
        embeddingLength: embedding.length,
      });

      return embedding;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logService.error('Ошибка генерации эмбеддинга через Llama', {
        requestId,
        executionTime,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Генерация JSON через Llama
   */
  async generateJSON<T = Record<string, unknown>>(
    messages: ILLMMessage[],
    options: ILLMRequestOptions = {},
  ): Promise<ILLMJsonResult<T>> {
    try {
      // Добавляем инструкцию для JSON ответа
      const jsonMessages: ILLMMessage[] = [
        ...messages,
        {
          role: LLMMessageRole.SYSTEM,
          content:
            'Please respond with valid JSON only. Do not include any explanations or additional text.',
        },
      ];

      const textResult = await this.generateText(jsonMessages, options);

      // Парсим JSON ответ
      let data: T;
      try {
        data = JSON.parse(textResult.text) as T;
      } catch (parseError) {
        this.logService.warn('Не удалось распарсить JSON ответ от Llama', {
          content: textResult.text,
          error: parseError instanceof Error ? parseError.message : String(parseError),
        });

        // Выбрасываем ошибку если не удалось распарсить
        throw new Error(
          `Не удалось распарсить JSON ответ от Llama: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        );
      }

      return {
        data,
        requestInfo: textResult.requestInfo,
      };
    } catch (error) {
      this.logService.error('Ошибка генерации JSON через Llama', {
        error: error instanceof Error ? error.message : String(error),
        messagesCount: messages.length,
        options,
      });

      // Выбрасываем ошибку дальше
      throw error;
    }
  }

  /**
   * Потоковая генерация текста через Llama - перегрузка для строки
   */
  async generateTextStream(
    prompt: string,
    model: string,
    onChunk: (chunk: string) => void,
  ): Promise<void>;

  /**
   * Потоковая генерация текста через Llama - перегрузка для сообщений
   */
  async generateTextStream(
    messages: ILLMMessage[],
    callbacks: ILLMStreamCallbacks,
    options?: ILLMRequestOptions,
  ): Promise<void>;

  /**
   * Потоковая генерация текста через Llama - основная реализация
   */
  async generateTextStream(
    messagesOrPrompt: ILLMMessage[] | string,
    callbacksOrModel: ILLMStreamCallbacks | string,
    optionsOrCallback?: ILLMRequestOptions | ((chunk: string) => void),
  ): Promise<void> {
    // Определяем тип входных данных
    let messages: ILLMMessage[];
    let callbacks: ILLMStreamCallbacks;
    let options: ILLMRequestOptions = {};

    if (typeof messagesOrPrompt === 'string') {
      // Вызов со строкой: generateTextStream(prompt, model, onChunk)
      messages = [{ role: LLMMessageRole.USER, content: messagesOrPrompt }];
      const model = callbacksOrModel as string;
      const onChunk = optionsOrCallback as (chunk: string) => void;

      options.model = model;
      callbacks = {
        onProgress: onChunk,
      };
    } else {
      // Вызов с массивом сообщений
      messages = messagesOrPrompt;
      callbacks = callbacksOrModel as ILLMStreamCallbacks;
      options = (optionsOrCallback as ILLMRequestOptions) || {};
    }

    try {
      if (callbacks.onStart) {
        callbacks.onStart();
      }

      // Пока реализуем через обычный запрос
      // В будущем можно добавить поддержку Server-Sent Events
      const result = await this.generateText(messages, options);

      if (callbacks.onProgress) {
        // Имитируем потоковую передачу, разбивая текст на части
        const resultText = typeof result === 'string' ? result : result.text;
        const words = resultText.split(' ');
        let currentText = '';

        for (const word of words) {
          currentText += (currentText ? ' ' : '') + word;
          callbacks.onProgress(currentText);

          // Небольшая задержка для имитации потока
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      if (callbacks.onComplete) {
        const resultText = typeof result === 'string' ? result : result.text;
        callbacks.onComplete(resultText);
      }
    } catch (error) {
      if (callbacks.onError) {
        callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }

  /**
   * Оценка количества токенов (приблизительная)
   */
  estimateTokens(text: string): number {
    // Простая оценка: примерно 3.5 символа на токен для Llama
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Получение информации о провайдере
   */
  getProviderInfo(): {
    type: LLMProviderType;
    name: string;
    models: string[];
    features: string[];
  } {
    return {
      type: this.providerType,
      name: this.providerName,
      models: ['llama3.2:3b', 'llama3.3:70b', 'llama3.1:8b', 'llama3.2:instruct'],
      features: ['text_generation', 'json_generation', 'streaming', 'function_calling'],
    };
  }

  // ======= ПРИВАТНЫЕ МЕТОДЫ =======

  /**
   * Создает информацию о запросе
   */
  private createRequestInfo(
    options: ILLMRequestOptions,
    fromCache: boolean,
    executionTime?: number,
  ): ILLMRequestInfo {
    return {
      requestId: this.generateRequestId(),
      fromCache,
      executionTime: executionTime || 0,
      model: options.model || this.defaultModel,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }

  /**
   * Генерирует уникальный ID запроса
   */
  private generateRequestId(): string {
    return `llama_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LogService } from '../../logging/log.service';
import { CacheService } from '../../cache/cache.service';
import { MessageQueueService } from '../../message-queue/message-queue.service';
import { MessageContext } from '../../common/interfaces/message-processor.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import OpenAI from 'openai';
import {
  ChatMessage,
  OpenAIRequestOptions,
  OpenAIRequestInfo,
  TextGenerationResult,
  JSONGenerationResult,
} from '../../common/interfaces/openai-types.interface';

/**
 * Интерфейс для отправки событий мониторинга
 */
export interface MonitoringEvent {
  type: 'request_start' | 'request_complete' | 'request_error' | 'budget_usage';
  requestId?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  error?: string;
  costUSD?: number;
  timestamp: Date;
}

/**
 * Упрощенный core сервис OpenAI для LLM системы
 * Отправляет события через EventEmitter для децентрализованного мониторинга
 */
@Injectable()
export class OpenAICoreService implements OnModuleDestroy {
  private readonly openai: OpenAI;
  private readonly model: string;
  private readonly defaultTemperature: number;
  private readonly maxResponseTokens: number;
  private readonly timeout: number;
  private readonly retries: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly queueService: MessageQueueService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(OpenAICoreService.name);

    // Получаем конфигурацию OpenAI
    const openaiConfig = this.configService.get<{
      apiKey?: string;
      organization?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      timeout?: number;
      retries?: number;
    }>('openai');
    const apiKey = openaiConfig?.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      this.logService.warn('OpenAI API ключ не найден. Сервис будет работать в режиме заглушек.');
    }

    // Инициализируем OpenAI клиент
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY || '',
      organization: openaiConfig?.organization,
      timeout: openaiConfig?.timeout || 30000,
      maxRetries: openaiConfig?.retries || 3,
    });

    this.model = openaiConfig?.model || 'gpt-3.5-turbo';
    this.defaultTemperature = openaiConfig?.temperature || 0.7;
    this.maxResponseTokens = openaiConfig?.maxTokens || 2048;
    this.timeout = openaiConfig?.timeout || 30000;
    this.retries = openaiConfig?.retries || 3;

    this.logService.log('LLM OpenAI Core сервис инициализирован', {
      model: this.model,
      hasApiKey: !!apiKey,
      timeout: this.timeout,
      retries: this.retries,
    });
  }

  async onModuleDestroy() {
    this.logService.log('Освобождение ресурсов LLM OpenAI Core Service');
  }

  /**
   * Основной метод для отправки запросов к OpenAI API
   */
  async sendRequest<T = string>(
    model: string,
    messages: ChatMessage[],
    options: OpenAIRequestOptions = {},
  ): Promise<T> {
    const requestId = this.generateRequestId();
    const useModel = model || this.model;
    const {
      temperature = this.defaultTemperature,
      max_tokens = this.maxResponseTokens,
      parseJson = false,
      useCache = true,
      cacheTTL = 3600,
      response_format,
      seed,
      top_p,
      frequency_penalty,
      presence_penalty,
    } = options;

    // Генерируем ключ кэша
    const cacheKey = useCache ? this.generateCacheKey(useModel, messages, options) : null;

    // Отправляем событие начала запроса
    this.emitMonitoringEvent({
      type: 'request_start',
      requestId,
      model: useModel,
      promptTokens: this.estimateTokenCount(JSON.stringify(messages)),
      timestamp: new Date(),
    });

    // Проверяем кэш
    if (useCache && cacheKey) {
      const cachedResult = await this.cacheService.get<T>(this.formatCacheKey(cacheKey));
      if (cachedResult) {
        this.logService.debug('Использован кэшированный результат запроса');
        this.emitMonitoringEvent({
          type: 'request_complete',
          requestId,
          model: useModel,
          completionTokens: 0, // Кэшированный результат
          timestamp: new Date(),
        });
        return cachedResult;
      }
    }

    try {
      // Выполняем запрос через очередь
      const messageContext: MessageContext = {
        id: requestId,
        type: 'openai_request',
        source: 'llm_openai_core',
        content: JSON.stringify(messages),
        metadata: {
          model: useModel,
          options: {
            temperature,
            max_tokens,
            parseJson,
          },
        },
        createdAt: new Date(),
      };

      const queueResult = await this.queueService.enqueue<T>(messageContext, async () => {
        // Реальная логика вызова OpenAI API
        const startTime = Date.now();

        try {
          // Проверяем наличие API ключа
          const apiKey =
            this.configService.get<string>('openai.apiKey') || process.env.OPENAI_API_KEY;
          if (!apiKey || apiKey === '') {
            const error = new Error(
              'OpenAI API key not configured. Please configure OPENAI_API_KEY environment variable or openai.apiKey in config',
            );
            this.logService.error('OpenAI API ключ не настроен', {
              error: error.message,
              requestId,
            });
            throw error;
          }

          // Конвертируем наши сообщения в формат OpenAI
          const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages.map(
            msg => ({
              role: msg.role as 'system' | 'user' | 'assistant',
              content: msg.content,
            }),
          );

          // Подготавливаем параметры запроса
          const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
            model: useModel,
            messages: openaiMessages,
            temperature,
            max_tokens,
            ...(seed && { seed }),
            ...(top_p && { top_p }),
            ...(frequency_penalty && { frequency_penalty }),
            ...(presence_penalty && { presence_penalty }),
          };

          // Если нужен JSON ответ, добавляем соответствующий формат
          if (parseJson) {
            if (response_format) {
              requestParams.response_format = response_format;
            } else {
              requestParams.response_format = { type: 'json_object' };
            }
          }

          this.logService.debug('Отправляем запрос к OpenAI API', {
            requestId,
            model: useModel,
            messagesCount: messages.length,
            temperature,
            max_tokens,
            parseJson,
          });

          // Выполняем запрос к OpenAI
          const completion = await this.openai.chat.completions.create(requestParams);

          const executionTime = Date.now() - startTime;
          const responseContent = completion.choices[0]?.message?.content || '';

          this.logService.debug('Получен ответ от OpenAI API', {
            requestId,
            executionTime,
            promptTokens: completion.usage?.prompt_tokens,
            completionTokens: completion.usage?.completion_tokens,
            totalTokens: completion.usage?.total_tokens,
          });

          // Отправляем событие мониторинга с реальными данными
          this.emitMonitoringEvent({
            type: 'request_complete',
            requestId,
            model: useModel,
            promptTokens: completion.usage?.prompt_tokens,
            completionTokens: completion.usage?.completion_tokens,
            totalTokens: completion.usage?.total_tokens,
            timestamp: new Date(),
          });

          // Парсим результат если нужно
          let result: T;
          if (parseJson) {
            try {
              result = JSON.parse(responseContent) as T;
            } catch (parseError) {
              this.logService.warn('Не удалось распарсить JSON ответ от OpenAI', {
                requestId,
                content: responseContent,
                error: parseError instanceof Error ? parseError.message : String(parseError),
              });
              // Возвращаем как есть, если не удалось распарсить
              result = responseContent as T;
            }
          } else {
            result = responseContent as T;
          }

          return {
            success: true,
            handled: true,
            context: messageContext,
            result,
          };
        } catch (apiError) {
          const executionTime = Date.now() - startTime;

          this.logService.error('Ошибка вызова OpenAI API', {
            requestId,
            executionTime,
            error: apiError instanceof Error ? apiError.message : String(apiError),
            model: useModel,
          });

          // Отправляем событие об ошибке
          this.emitMonitoringEvent({
            type: 'request_error',
            requestId,
            model: useModel,
            error: apiError instanceof Error ? apiError.message : String(apiError),
            timestamp: new Date(),
          });

          throw apiError;
        }
      });

      const result = queueResult.result;

      // Сохраняем в кэш
      if (useCache && cacheKey && result !== null && result !== undefined) {
        await this.cacheService.set(this.formatCacheKey(cacheKey), result, cacheTTL);
      }

      return result;
    } catch (error) {
      this.logService.error('Ошибка выполнения запроса к OpenAI API', {
        error: error instanceof Error ? error.message : String(error),
        requestId,
        model: useModel,
      });

      this.emitMonitoringEvent({
        type: 'request_error',
        requestId,
        model: useModel,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Генерация текста
   */
  async generateText(
    messages: ChatMessage[],
    options: OpenAIRequestOptions = {},
  ): Promise<TextGenerationResult> {
    const text = await this.sendRequest<string>(options.model || this.model, messages, options);

    return {
      text,
      requestInfo: this.createRequestInfo(options, false),
    };
  }

  /**
   * Генерация JSON
   */
  async generateJSON<T = Record<string, unknown>>(
    messages: ChatMessage[],
    options: OpenAIRequestOptions = {},
  ): Promise<JSONGenerationResult<T>> {
    const data = await this.sendRequest<T>(options.model || this.model, messages, {
      ...options,
      parseJson: true,
    });

    return {
      data,
      requestInfo: this.createRequestInfo(options, false),
    };
  }

  /**
   * Генерация векторного представления (эмбеддинга) для текста
   */
  async generateEmbedding(
    text: string,
    model: string = 'text-embedding-ada-002',
  ): Promise<number[]> {
    const requestId = this.generateRequestId();
    this.emitMonitoringEvent({ type: 'request_start', requestId, model, timestamp: new Date() });

    try {
      this.logService.debug('Отправляем запрос на эмбеддинг к OpenAI API', {
        requestId,
        model,
        textLength: text.length,
      });

      const response = await this.openai.embeddings.create({
        input: text,
        model,
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw new Error('API не вернул эмбеддинг в ожидаемом формате.');
      }

      this.emitMonitoringEvent({
        type: 'request_complete',
        requestId,
        model,
        promptTokens: response.usage.prompt_tokens,
        totalTokens: response.usage.total_tokens,
        timestamp: new Date(),
      });

      return embedding;
    } catch (error) {
      this.logService.error('Ошибка генерации эмбеддинга через OpenAI', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      this.emitMonitoringEvent({
        type: 'request_error',
        requestId,
        model,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });
      throw error;
    }
  }

  // ======= ПРИВАТНЫЕ МЕТОДЫ =======

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCacheKey(
    model: string,
    messages: ChatMessage[],
    options: OpenAIRequestOptions,
  ): { type: 'openai'; model: string; messages: ChatMessage[]; [key: string]: unknown } {
    return {
      type: 'openai',
      model,
      messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      parseJson: options.parseJson,
    };
  }

  private estimateTokenCount(text: string): number {
    // Простая оценка: примерно 4 символа на токен
    return Math.ceil(text.length / 4);
  }

  private emitMonitoringEvent(event: MonitoringEvent): void {
    try {
      this.eventEmitter.emit('openai.monitoring', event);
    } catch (error) {
      this.logService.warn('Ошибка отправки события мониторинга', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private formatCacheKey(cacheKey: unknown): string {
    return `openai:${this.simpleHash(JSON.stringify(cacheKey))}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Конвертируем в 32-битное целое
    }
    return Math.abs(hash).toString(36);
  }

  private createRequestInfo(options: OpenAIRequestOptions, fromCache: boolean): OpenAIRequestInfo {
    return {
      requestId: this.generateRequestId(),
      fromCache,
      executionTime: fromCache ? 0 : 0, // Время выполнения будет устанавливаться в месте вызова
      model: options.model || this.model,
    };
  }
}

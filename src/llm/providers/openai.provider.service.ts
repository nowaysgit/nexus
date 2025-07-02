import { Injectable } from '@nestjs/common';
import { LogService } from '../../logging/log.service';
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
import { OpenAICoreService } from './openai-core.service';
import { ChatMessage } from '../../common/interfaces/openai-types.interface';

/**
 * OpenAI провайдер для работы с GPT моделями
 * Реализует общий интерфейс ILLMProvider
 */
@Injectable()
export class OpenAIProviderService implements ILLMProvider {
  readonly providerType = LLMProviderType.OPENAI;
  readonly providerName = 'OpenAI GPT';

  constructor(
    private readonly openaiCoreService: OpenAICoreService,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(OpenAIProviderService.name);
  }

  /**
   * Проверка доступности OpenAI API
   */
  async checkAvailability(): Promise<boolean> {
    try {
      // Отправляем тестовый запрос
      const testMessages: ILLMMessage[] = [{ role: LLMMessageRole.USER, content: 'Test' }];

      await this.generateText(testMessages, {
        maxTokens: 5,
        temperature: 0,
      });

      return true;
    } catch (error) {
      this.logService.warn('OpenAI API недоступен', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Генерация текста через OpenAI
   */
  async generateText(
    messages: ILLMMessage[],
    options: ILLMRequestOptions = {},
  ): Promise<ILLMTextResult> {
    const openaiMessages = this.convertMessages(messages);
    const openaiOptions = this.convertOptions(options);

    try {
      const response = await this.openaiCoreService.sendRequest(
        options.model || 'gpt-4',
        openaiMessages,
        openaiOptions,
      );

      return {
        text: response,
        requestInfo: this.createRequestInfo(options, false),
      };
    } catch (error) {
      this.logService.error('Ошибка генерации текста через OpenAI', {
        error: error instanceof Error ? error.message : String(error),
        messagesCount: messages.length,
        options,
      });
      throw error;
    }
  }

  /**
   * Генерация JSON через OpenAI
   */
  async generateJSON<T = Record<string, unknown>>(
    messages: ILLMMessage[],
    options: ILLMRequestOptions = {},
  ): Promise<ILLMJsonResult<T>> {
    const openaiMessages = this.convertMessages(messages);
    const openaiOptions = this.convertOptions(options);
    openaiOptions.parseJson = true;

    try {
      const response = await this.openaiCoreService.sendRequest<T>(
        options.model || 'gpt-4',
        openaiMessages,
        openaiOptions,
      );

      return {
        data: response,
        requestInfo: this.createRequestInfo(options, false),
      };
    } catch (error) {
      this.logService.error('Ошибка генерации JSON через OpenAI', {
        error: error instanceof Error ? error.message : String(error),
        messagesCount: messages.length,
        options,
      });
      throw error;
    }
  }

  /**
   * Потоковая генерация текста через OpenAI
   */
  async generateTextStream(
    messages: ILLMMessage[],
    callbacks: ILLMStreamCallbacks,
    options: ILLMRequestOptions = {},
  ): Promise<void> {
    // Для упрощения пока используем обычную генерацию
    // В будущем можно добавить поддержку стриминга
    try {
      if (callbacks.onStart) {
        callbacks.onStart();
      }

      const result = await this.generateText(messages, options);

      if (callbacks.onProgress) {
        callbacks.onProgress(result.text);
      }

      if (callbacks.onComplete) {
        callbacks.onComplete(result.text);
      }
    } catch (error) {
      if (callbacks.onError) {
        callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }

  /**
   * Генерация векторного представления (эмбеддинга) для текста через OpenAI.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embedding = await this.openaiCoreService.generateEmbedding(text);
      return embedding;
    } catch (error) {
      this.logService.error('Ошибка генерации эмбеддинга через OpenAI', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Оценка количества токенов (приблизительная)
   */
  estimateTokens(text: string): number {
    // Простая оценка: примерно 4 символа на токен для английского
    // Для русского языка коэффициент может быть другим
    return Math.ceil(text.length / 4);
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
      models: ['gpt-4', 'gpt-4-32k', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'],
      features: ['text_generation', 'json_generation', 'streaming', 'function_calling', 'vision'],
    };
  }

  // ======= ПРИВАТНЫЕ МЕТОДЫ =======

  /**
   * Конвертирует сообщения из общего формата в формат OpenAI
   */
  private convertMessages(messages: ILLMMessage[]): ChatMessage[] {
    return messages.map(message => ({
      role: message.role,
      content: message.content,
      name: message.name,
    }));
  }

  /**
   * Конвертирует опции из общего формата в формат OpenAI
   */
  private convertOptions(options: ILLMRequestOptions) {
    return {
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      parseJson: options.parseJson || false,
      useCache: options.useCache,
      cacheTTL: options.cacheTTL,
      retries: options.retries,
      timeout: options.timeout,
      model: options.model,
      top_p: options.topP,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      seed: options.seed,
    };
  }

  /**
   * Создает информацию о запросе
   */
  private createRequestInfo(options: ILLMRequestOptions, fromCache: boolean): ILLMRequestInfo {
    return {
      requestId: this.generateRequestId(),
      fromCache,
      executionTime: 0, // Будет заполнено позже
      model: options.model || 'gpt-4',
    };
  }

  /**
   * Генерирует уникальный ID запроса
   */
  private generateRequestId(): string {
    return `openai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

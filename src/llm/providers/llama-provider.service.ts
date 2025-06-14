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
 * Интерфейс для запроса к Llama API
 */
interface LlamaApiRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

/**
 * Интерфейс для ответа от Llama API
 */
interface LlamaApiResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Llama 4 провайдер для работы с Llama моделями
 * Реализует общий интерфейс ILLMProvider
 */
@Injectable()
export class LlamaProviderService implements ILLMProvider {
  readonly providerType = LLMProviderType.LLAMA;
  readonly providerName = 'Llama 4';

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
    this.defaultModel = llamaConfig?.model || process.env.LLM_LLAMA_MODEL || 'llama-4-70b';
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
      // Отправляем тестовый запрос
      const testMessages: ILLMMessage[] = [{ role: LLMMessageRole.USER, content: 'Test' }];

      await this.generateText(testMessages, {
        maxTokens: 5,
        temperature: 0,
      });

      return true;
    } catch (error) {
      this.logService.warn('Llama API недоступен', {
        error: error instanceof Error ? error.message : String(error),
        endpoint: this.endpoint,
      });
      return false;
    }
  }

  /**
   * Генерация текста через Llama
   */
  async generateText(
    messages: ILLMMessage[],
    options: ILLMRequestOptions = {},
  ): Promise<ILLMTextResult> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.logService.debug('Отправляем запрос к Llama API', {
        requestId,
        endpoint: this.endpoint,
        messagesCount: messages.length,
        options,
      });

      // Проверяем доступность API
      if (!this.endpoint || this.endpoint === 'http://localhost:8080') {
        this.logService.error(
          'Llama API endpoint не настроен, проверьте настройки LLM_LLAMA_ENDPOINT',
        );
        throw new Error('Llama API endpoint не настроен. Проверьте настройки LLM_LLAMA_ENDPOINT.');
      }

      // Подготавливаем запрос
      const request: LlamaApiRequest = {
        model: options.model || this.defaultModel,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stream: false,
      };

      // Выполняем запрос к Llama API
      const response = await this.httpClient.post<LlamaApiResponse>(
        '/v1/chat/completions',
        request,
      );

      const executionTime = Date.now() - startTime;
      const responseContent = response.data.choices[0]?.message?.content || '';

      this.logService.debug('Получен ответ от Llama API', {
        requestId,
        executionTime,
        promptTokens: response.data.usage?.prompt_tokens,
        completionTokens: response.data.usage?.completion_tokens,
        totalTokens: response.data.usage?.total_tokens,
      });

      return {
        text: responseContent,
        requestInfo: {
          requestId,
          fromCache: false,
          executionTime,
          model: response.data.model || request.model,
          promptTokens: response.data.usage?.prompt_tokens,
          completionTokens: response.data.usage?.completion_tokens,
          totalTokens: response.data.usage?.total_tokens,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logService.error('Ошибка генерации текста через Llama', {
        requestId,
        executionTime,
        error: error instanceof Error ? error.message : String(error),
        messagesCount: messages.length,
        options,
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
   * Потоковая генерация текста через Llama
   */
  async generateTextStream(
    messages: ILLMMessage[],
    callbacks: ILLMStreamCallbacks,
    options: ILLMRequestOptions = {},
  ): Promise<void> {
    try {
      if (callbacks.onStart) {
        callbacks.onStart();
      }

      // Пока реализуем через обычный запрос
      // В будущем можно добавить поддержку Server-Sent Events
      const result = await this.generateText(messages, options);

      if (callbacks.onProgress) {
        // Имитируем потоковую передачу, разбивая текст на части
        const words = result.text.split(' ');
        let currentText = '';

        for (const word of words) {
          currentText += (currentText ? ' ' : '') + word;
          callbacks.onProgress(currentText);

          // Небольшая задержка для имитации потока
          await new Promise(resolve => setTimeout(resolve, 50));
        }
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
      models: ['llama-4-70b', 'llama-4-13b', 'llama-4-7b', 'llama-4-instruct'],
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

import { Injectable } from '@nestjs/common';
import {
  ILLMMessage,
  ILLMRequestOptions,
  ILLMTextResult,
  ILLMJsonResult,
  ILLMStreamCallbacks,
  LLMProviderType,
} from '../../../src/common/interfaces/llm-provider.interface';

/**
 * Типизированный мок для LLMService
 * Предоставляет типизированные методы для тестирования
 */
@Injectable()
export class MockLLMService {
  /**
   * Мок для метода generateText
   */
  generateText = jest.fn<Promise<ILLMTextResult>, [ILLMMessage[], ILLMRequestOptions?]>(
    async () => ({
      text: 'Мок ответ от LLM',
      requestInfo: {
        requestId: 'mock-request-id',
        fromCache: false,
        executionTime: 100,
        totalTokens: 50,
        model: 'mock-model',
      },
    }),
  );

  /**
   * Мок для метода generateJSON
   */
  generateJSON = jest.fn<Promise<ILLMJsonResult<any>>, [ILLMMessage[], ILLMRequestOptions?]>(
    async () => ({
      data: { result: 'Мок JSON ответ' },
      requestInfo: {
        requestId: 'mock-json-request-id',
        fromCache: false,
        executionTime: 120,
        totalTokens: 60,
        model: 'mock-model',
      },
    }),
  );

  /**
   * Мок для метода generateTextStream
   */
  generateTextStream = jest.fn<
    Promise<void>,
    [ILLMMessage[], ILLMStreamCallbacks, ILLMRequestOptions?]
  >(async (_messages, callbacks) => {
    if (callbacks.onStart) {
      callbacks.onStart();
    }

    const text = 'Мок потоковый ответ от LLM';

    if (callbacks.onProgress) {
      callbacks.onProgress(text);
    }

    if (callbacks.onComplete) {
      callbacks.onComplete(text);
    }

    return Promise.resolve();
  });

  /**
   * Мок для метода estimateTokens
   */
  estimateTokens = jest.fn<number, [string]>(text => {
    return Math.ceil(text.length / 4);
  });

  /**
   * Мок для метода checkAvailability
   */
  checkAvailability = jest.fn<Promise<boolean>, []>(async () => true);

  /**
   * Мок для метода switchProvider
   */
  switchProvider = jest.fn<Promise<void>, [LLMProviderType]>(async () => {
    return Promise.resolve();
  });

  /**
   * Мок для метода selectBestProvider
   */
  selectBestProvider = jest.fn<Promise<LLMProviderType>, []>(async () => {
    return Promise.resolve(LLMProviderType.OPENAI);
  });

  /**
   * Мок для метода getActiveProviderInfo
   */
  getActiveProviderInfo = jest.fn<
    { type: LLMProviderType; name: string; models: string[]; features: string[] },
    []
  >(() => ({
    type: LLMProviderType.OPENAI,
    name: 'Mock OpenAI Provider',
    models: ['gpt-4', 'gpt-3.5-turbo'],
    features: ['text generation', 'json generation', 'streaming'],
  }));

  /**
   * Мок для метода getProvidersInfo
   */
  getProvidersInfo = jest.fn<
    {
      activeProvider: LLMProviderType;
      registeredProviders: LLMProviderType[];
      providersInfo: Array<{
        type: LLMProviderType;
        name: string;
        models: string[];
        features: string[];
      }>;
    },
    []
  >(() => ({
    activeProvider: LLMProviderType.OPENAI,
    registeredProviders: [LLMProviderType.OPENAI, LLMProviderType.LLAMA],
    providersInfo: [
      {
        type: LLMProviderType.OPENAI,
        name: 'Mock OpenAI Provider',
        models: ['gpt-4', 'gpt-3.5-turbo'],
        features: ['text generation', 'json generation', 'streaming'],
      },
      {
        type: LLMProviderType.LLAMA,
        name: 'Mock Llama Provider',
        models: ['llama-2-70b', 'llama-2-13b'],
        features: ['text generation', 'json generation'],
      },
    ],
  }));

  /**
   * Мок для метода checkAllProvidersAvailability
   */
  checkAllProvidersAvailability = jest.fn<Promise<Record<LLMProviderType, boolean>>, []>(
    async () => ({
      [LLMProviderType.OPENAI]: true,
      [LLMProviderType.LLAMA]: true,
      [LLMProviderType.CLAUDE]: false,
      [LLMProviderType.GEMINI]: false,
      [LLMProviderType.CUSTOM]: false,
    }),
  );

  /**
   * Мок для метода getActiveProvider
   * @deprecated
   */
  getActiveProvider = jest.fn<any, []>(() => ({
    providerType: LLMProviderType.OPENAI,
    providerName: 'Mock OpenAI Provider',
  }));

  /**
   * Сброс всех моков
   */
  reset(): void {
    this.generateText.mockClear();
    this.generateJSON.mockClear();
    this.generateTextStream.mockClear();
    this.estimateTokens.mockClear();
    this.checkAvailability.mockClear();
    this.switchProvider.mockClear();
    this.selectBestProvider.mockClear();
    this.getActiveProviderInfo.mockClear();
    this.getProvidersInfo.mockClear();
    this.checkAllProvidersAvailability.mockClear();
    this.getActiveProvider.mockClear();
  }
}

import { Injectable } from '@nestjs/common';
import { LogService } from '../../logging/log.service';
import { BaseService } from '../../common/base/base.service';
import {
  ILLMMessage,
  ILLMRequestOptions,
  ILLMTextResult,
  ILLMJsonResult,
  ILLMStreamCallbacks,
  LLMProviderType,
  ILLMProvider,
} from '../../common/interfaces/llm-provider.interface';
import { LLMProviderManagerService } from './llm-provider-manager.service';

// Реэкспортируем интерфейсы для использования в других модулях
export { ILLMMessage, LLMProviderType } from '../../common/interfaces/llm-provider.interface';

/**
 * Единый LLM сервис для работы с различными провайдерами AI моделей
 * Предоставляет унифицированный интерфейс для всего приложения
 */
@Injectable()
export class LLMService extends BaseService {
  constructor(
    private readonly providerManager: LLMProviderManagerService,
    logService: LogService,
  ) {
    super(logService);
  }

  /**
   * Генерация текста через активный провайдер
   */
  async generateText(
    messages: ILLMMessage[],
    options?: ILLMRequestOptions,
  ): Promise<ILLMTextResult> {
    return this.withErrorHandling('генерации текста', async () => {
      const provider = this.providerManager.getActiveProvider();
      this.logDebug(`Генерация текста через провайдер: ${provider.providerName}`);

      return await provider.generateText(messages, options);
    });
  }

  /**
   * Генерация JSON через активный провайдер
   */
  async generateJSON<T = Record<string, unknown>>(
    messages: ILLMMessage[],
    options?: ILLMRequestOptions,
  ): Promise<ILLMJsonResult<T>> {
    return this.withErrorHandling('генерации JSON', async () => {
      const provider = this.providerManager.getActiveProvider();
      this.logDebug(`Генерация JSON через провайдер: ${provider.providerName}`);

      return await provider.generateJSON<T>(messages, options);
    });
  }

  /**
   * Потоковая генерация текста через активный провайдер
   */
  async generateTextStream(
    messages: ILLMMessage[],
    callbacks: ILLMStreamCallbacks,
    options?: ILLMRequestOptions,
  ): Promise<void> {
    return this.withErrorHandling('потоковой генерации', async () => {
      const provider = this.providerManager.getActiveProvider();
      this.logDebug(`Потоковая генерация через провайдер: ${provider.providerName}`);

      return await provider.generateTextStream(messages, callbacks, options);
    });
  }

  /**
   * Оценка количества токенов
   */
  estimateTokens(text: string): number {
    try {
      return this.withErrorHandlingSync('оценки токенов', () => {
        const provider = this.providerManager.getActiveProvider();
        return provider.estimateTokens(text);
      });
    } catch (_error) {
      this.logWarning('Ошибка оценки токенов, используется простая оценка');
      // Простая оценка как fallback
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Проверка доступности активного провайдера
   */
  async checkAvailability(): Promise<boolean> {
    try {
      return await this.withErrorHandling('проверки доступности активного провайдера', async () => {
        const provider = this.providerManager.getActiveProvider();
        return await provider.checkAvailability();
      });
    } catch (_error) {
      return false;
    }
  }

  /**
   * Переключение на другой провайдер
   */
  async switchProvider(providerType: LLMProviderType): Promise<void> {
    return this.withErrorHandling(`переключения на провайдер ${providerType}`, async () => {
      this.providerManager.setActiveProvider(providerType);
      this.logInfo(`Переключен на провайдер: ${providerType}`);

      // Проверяем доступность нового провайдера
      const isAvailable = await this.checkAvailability();
      if (!isAvailable) {
        this.logWarning(`Провайдер ${providerType} недоступен`);
      }
    });
  }

  /**
   * Автоматический выбор лучшего доступного провайдера
   */
  async selectBestProvider(): Promise<LLMProviderType> {
    return this.withErrorHandling('автоматического выбора провайдера', async () => {
      const selectedProvider = await this.providerManager.selectBestAvailableProvider();
      this.logInfo(`Автоматически выбран провайдер: ${selectedProvider}`);
      return selectedProvider;
    });
  }

  /**
   * Получение информации об активном провайдере
   */
  getActiveProviderInfo(): {
    type: LLMProviderType;
    name: string;
    models: string[];
    features: string[];
  } {
    return this.withErrorHandlingSync('получения информации об активном провайдере', () => {
      const provider = this.providerManager.getActiveProvider();
      return provider.getProviderInfo();
    });
  }

  /**
   * Получение полной информации о менеджере провайдеров
   */
  getProvidersInfo(): {
    activeProvider: LLMProviderType;
    registeredProviders: LLMProviderType[];
    providersInfo: Array<{
      type: LLMProviderType;
      name: string;
      models: string[];
      features: string[];
    }>;
  } {
    return this.providerManager.getManagerInfo();
  }

  /**
   * Проверка доступности всех провайдеров
   */
  async checkAllProvidersAvailability(): Promise<Record<LLMProviderType, boolean>> {
    return await this.providerManager.checkAllProvidersAvailability();
  }

  /**
   * Получение активного провайдера
   * @deprecated Используйте getActiveProviderInfo вместо этого метода
   */
  getActiveProvider(): ILLMProvider {
    return this.providerManager.getActiveProvider();
  }

  /**
   * Проверка доступности провайдера
   * @deprecated Используйте checkAvailability вместо этого метода
   */
  async checkProviderAvailability(): Promise<{ isAvailable: boolean }> {
    const isAvailable = await this.checkAvailability();
    return { isAvailable };
  }

  /**
   * Переключение на доступный провайдер
   * @deprecated Используйте selectBestProvider вместо этого метода
   */
  async switchToAvailableProvider(): Promise<{ name: string; type: LLMProviderType }> {
    const providerType = await this.selectBestProvider();
    const providerInfo = this.getActiveProviderInfo();
    return { name: providerInfo.name, type: providerType };
  }
}

import { Injectable } from '@nestjs/common';
import { LogService } from '../../logging/log.service';
import {
  ILLMMessage,
  ILLMRequestOptions,
  ILLMTextResult,
  ILLMJsonResult,
  ILLMStreamCallbacks,
  LLMProviderType,
  LLMMessageRole,
  ILLMProvider,
} from '../../common/interfaces/llm-provider.interface';
import { LLMProviderManagerService } from './llm-provider-manager.service';

// Реэкспортируем интерфейсы для использования в других модулях
export { ILLMMessage, LLMProviderType, LLMMessageRole } from '../../common/interfaces/llm-provider.interface';

/**
 * Единый LLM сервис для работы с различными провайдерами AI моделей
 * Предоставляет унифицированный интерфейс для всего приложения
 */
@Injectable()
export class LLMService {
  constructor(
    private readonly providerManager: LLMProviderManagerService,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(LLMService.name);
  }

  /**
   * Генерация текста через активный провайдер
   */
  async generateText(
    messages: ILLMMessage[],
    options?: ILLMRequestOptions,
  ): Promise<ILLMTextResult> {
    try {
      const provider = this.providerManager.getActiveProvider();
      this.logService.debug(`Генерация текста через провайдер: ${provider.providerName}`);

      return await provider.generateText(messages, options);
    } catch (error) {
      this.logService.error('Ошибка генерации текста', {
        error: error instanceof Error ? error.message : String(error),
        messagesCount: messages.length,
        options,
      });
      throw error;
    }
  }

  /**
   * Генерация JSON через активный провайдер
   */
  async generateJSON<T = Record<string, unknown>>(
    messages: ILLMMessage[],
    options?: ILLMRequestOptions,
  ): Promise<ILLMJsonResult<T>> {
    try {
      const provider = this.providerManager.getActiveProvider();
      this.logService.debug(`Генерация JSON через провайдер: ${provider.providerName}`);

      return await provider.generateJSON<T>(messages, options);
    } catch (error) {
      this.logService.error('Ошибка генерации JSON', {
        error: error instanceof Error ? error.message : String(error),
        messagesCount: messages.length,
        options,
      });
      throw error;
    }
  }

  /**
   * Потоковая генерация текста через активный провайдер
   */
  async generateTextStream(
    messages: ILLMMessage[],
    callbacks: ILLMStreamCallbacks,
    options?: ILLMRequestOptions,
  ): Promise<void> {
    try {
      const provider = this.providerManager.getActiveProvider();
      this.logService.debug(`Потоковая генерация через провайдер: ${provider.providerName}`);

      return await provider.generateTextStream(messages, callbacks, options);
    } catch (error) {
      this.logService.error('Ошибка потоковой генерации', {
        error: error instanceof Error ? error.message : String(error),
        messagesCount: messages.length,
        options,
      });
      throw error;
    }
  }

  /**
   * Оценка количества токенов
   */
  estimateTokens(text: string): number {
    try {
      const provider = this.providerManager.getActiveProvider();
      return provider.estimateTokens(text);
    } catch (error) {
      this.logService.warn('Ошибка оценки токенов, используется простая оценка', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Простая оценка как fallback
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Проверка доступности активного провайдера
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const provider = this.providerManager.getActiveProvider();
      return await provider.checkAvailability();
    } catch (error) {
      this.logService.error('Ошибка проверки доступности активного провайдера', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Переключение на другой провайдер
   */
  async switchProvider(providerType: LLMProviderType): Promise<void> {
    try {
      this.providerManager.setActiveProvider(providerType);
      this.logService.log(`Переключен на провайдер: ${providerType}`);

      // Проверяем доступность нового провайдера
      const isAvailable = await this.checkAvailability();
      if (!isAvailable) {
        this.logService.warn(`Провайдер ${providerType} недоступен`);
      }
    } catch (error) {
      this.logService.error(`Ошибка переключения на провайдер ${providerType}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Автоматический выбор лучшего доступного провайдера
   */
  async selectBestProvider(): Promise<LLMProviderType> {
    try {
      const selectedProvider = await this.providerManager.selectBestAvailableProvider();
      this.logService.log(`Автоматически выбран провайдер: ${selectedProvider}`);
      return selectedProvider;
    } catch (error) {
      this.logService.error('Ошибка автоматического выбора провайдера', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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
    try {
      const provider = this.providerManager.getActiveProvider();
      return provider.getProviderInfo();
    } catch (error) {
      this.logService.error('Ошибка получения информации об активном провайдере', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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

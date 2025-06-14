import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LogService } from '../../logging/log.service';
import {
  ILLMProvider,
  ILLMProviderManager,
  LLMProviderType,
} from '../../common/interfaces/llm-provider.interface';

/**
 * Менеджер LLM провайдеров
 * Управляет различными провайдерами AI моделей и позволяет переключаться между ними
 */
@Injectable()
export class LLMProviderManagerService implements ILLMProviderManager {
  private readonly providers = new Map<LLMProviderType, ILLMProvider>();
  private activeProviderType: LLMProviderType;

  constructor(
    private readonly configService: ConfigService,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(LLMProviderManagerService.name);

    // Получаем активный провайдер из конфигурации
    this.activeProviderType = this.configService.get<LLMProviderType>(
      'llm.activeProvider',
      LLMProviderType.LLAMA,
    );

    this.logService.log(
      `Инициализирован менеджер LLM провайдеров. Активный провайдер: ${this.activeProviderType}`,
    );
  }

  /**
   * Регистрация нового провайдера
   */
  registerProvider(provider: ILLMProvider): void {
    const existingProvider = this.providers.get(provider.providerType);
    if (existingProvider) {
      this.logService.warn(
        `Провайдер ${provider.providerType} уже зарегистрирован, заменяю на новый`,
      );
    }

    this.providers.set(provider.providerType, provider);

    this.logService.log(
      `Зарегистрирован провайдер: ${provider.providerName} (${provider.providerType})`,
    );

    // Если это первый провайдер и активный не задан, делаем его активным
    if (this.providers.size === 1 && !this.activeProviderType) {
      this.activeProviderType = provider.providerType;
      this.logService.log(`Установлен активный провайдер по умолчанию: ${provider.providerType}`);
    }
  }

  /**
   * Получение активного провайдера
   */
  getActiveProvider(): ILLMProvider {
    const provider = this.providers.get(this.activeProviderType);

    if (!provider) {
      throw new Error(
        `Активный провайдер ${this.activeProviderType} не зарегистрирован. ` +
          `Доступные провайдеры: ${Array.from(this.providers.keys()).join(', ')}`,
      );
    }

    return provider;
  }

  /**
   * Получение провайдера по типу
   */
  getProvider(type: LLMProviderType): ILLMProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Получение списка всех провайдеров
   */
  getAllProviders(): ILLMProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Установка активного провайдера
   */
  setActiveProvider(type: LLMProviderType): void {
    const provider = this.providers.get(type);

    if (!provider) {
      throw new Error(
        `Провайдер ${type} не зарегистрирован. ` +
          `Доступные провайдеры: ${Array.from(this.providers.keys()).join(', ')}`,
      );
    }

    const oldProvider = this.activeProviderType;
    this.activeProviderType = type;

    this.logService.log(`Активный провайдер изменен с ${oldProvider} на ${type}`);
  }

  /**
   * Проверка доступности всех провайдеров
   */
  async checkAllProvidersAvailability(): Promise<Record<LLMProviderType, boolean>> {
    const results: Record<LLMProviderType, boolean> = {} as Record<LLMProviderType, boolean>;

    for (const [type, provider] of this.providers) {
      try {
        results[type] = await provider.checkAvailability();
        this.logService.debug(`Провайдер ${type}: ${results[type] ? 'доступен' : 'недоступен'}`);
      } catch (error) {
        results[type] = false;
        this.logService.warn(`Ошибка проверки доступности провайдера ${type}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Получение информации о менеджере провайдеров
   */
  getManagerInfo(): {
    activeProvider: LLMProviderType;
    registeredProviders: LLMProviderType[];
    providersInfo: Array<{
      type: LLMProviderType;
      name: string;
      models: string[];
      features: string[];
    }>;
  } {
    return {
      activeProvider: this.activeProviderType,
      registeredProviders: Array.from(this.providers.keys()),
      providersInfo: this.getAllProviders().map(provider => provider.getProviderInfo()),
    };
  }

  /**
   * Автоматический выбор лучшего доступного провайдера
   */
  async selectBestAvailableProvider(): Promise<LLMProviderType> {
    const availability = await this.checkAllProvidersAvailability();

    // Приоритет провайдеров (можно настроить через конфигурацию)
    const providerPriority = [
      LLMProviderType.OPENAI,
      LLMProviderType.CLAUDE,
      LLMProviderType.LLAMA,
      LLMProviderType.GEMINI,
      LLMProviderType.CUSTOM,
    ];

    for (const providerType of providerPriority) {
      if (availability[providerType] === true) {
        this.setActiveProvider(providerType);
        this.logService.log(`Автоматически выбран лучший доступный провайдер: ${providerType}`);
        return providerType;
      }
    }

    throw new Error('Ни один LLM провайдер не доступен');
  }
}

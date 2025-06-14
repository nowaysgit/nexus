import { LLMModule } from '../../../src/llm/llm.module';
import { LLMProviderManagerService } from '../../../src/llm/services/llm-provider-manager.service';
import { mockLlamaProviderService } from '../mocks/llama-provider.mock';
import { MockProviderFactory } from '../mocks';
import { TestConfig } from './index';

/**
 * Проверяет, содержит ли массив импортов LLMModule
 * @param imports массив импортов
 * @returns true если LLMModule присутствует
 */
export function containsLLMModule(imports: any[] = []): boolean {
  return imports.some(
    importItem =>
      importItem === LLMModule ||
      (importItem && importItem.name === 'LLMModule') ||
      (importItem && typeof importItem === 'function' && importItem.name === 'LLMModule'),
  );
}

/**
 * Добавляет моки для LLMModule
 * @param config конфигурация теста
 * @returns обновленная конфигурация теста с моками
 */
export function addLLMMocks(config: TestConfig): TestConfig {
  if (!config.providers) {
    config.providers = [];
  }

  // Добавляем мок LlamaProviderService
  if (
    !config.providers.some(
      p =>
        p &&
        ((p as any).provide === 'LlamaProviderService' || (p as any) === 'LlamaProviderService'),
    )
  ) {
    config.providers.push({
      provide: 'LlamaProviderService',
      useValue: mockLlamaProviderService,
    });
  }

  // Переопределяем LLMProviderManagerService для использования мока LlamaProviderService
  if (
    !config.providers.some(
      p =>
        p &&
        ((p as any).provide === LLMProviderManagerService ||
          (p as any) === LLMProviderManagerService),
    )
  ) {
    config.providers.push({
      provide: LLMProviderManagerService,
      useFactory: () => {
        const manager = {
          getProvider: jest.fn().mockImplementation(() => mockLlamaProviderService),
          getAvailableProviders: jest.fn().mockImplementation(() => [mockLlamaProviderService]),
          isProviderAvailable: jest.fn().mockImplementation(() => true),
          onModuleInit: jest.fn(),
        };
        return manager;
      },
    });
  }

  return config;
}

/**
 * Получает конфигурацию для тестов LLM
 */
export function getLLMTestConfig() {
  return {
    providers: MockProviderFactory.createLLMProviderMock(),
  };
}

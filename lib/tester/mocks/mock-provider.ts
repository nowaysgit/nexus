import { Provider } from '@nestjs/common';

/**
 * Фабрика для создания моков различных провайдеров в тестах
 */
export class MockProviderFactory {
  /**
   * Создает мок LLM провайдера для тестов
   * @returns Provider для LLM
   */
  static createLLMProviderMock(): Provider[] {
    const mockLLMService = {
      generateText: jest.fn().mockResolvedValue('Тестовый ответ от LLM'),
      generateJSON: jest.fn().mockResolvedValue({ result: 'success', data: {} }),
      estimateTokens: jest.fn().mockReturnValue(100),
      checkAvailability: jest.fn().mockResolvedValue(true),
      getActiveProvider: jest.fn().mockReturnValue('test-provider'),
      getActiveProviderInfo: jest.fn().mockReturnValue({
        name: 'Test Provider',
        type: 'test-provider',
        available: true,
        maxTokens: 4096,
        supportedModels: ['test-model'],
      }),
      getProvidersInfo: jest.fn().mockReturnValue({
        activeProvider: 'test-provider',
        providersInfo: [
          {
            name: 'Test Provider',
            type: 'test-provider',
            available: true,
            maxTokens: 4096,
            supportedModels: ['test-model'],
          }
        ],
        registeredProviders: ['test-provider'],
      }),
      setProvider: jest.fn().mockResolvedValue(true),
      selectBestAvailableProvider: jest.fn().mockResolvedValue('test-provider'),
    };

    return [
      {
        provide: 'LLMService',
        useValue: mockLLMService,
      }
    ];
  }

  /**
   * Создает мок провайдеров для телеграм-бота
   * @returns Provider[] для TelegramModule
   */
  static createTelegramProviderMocks(): Provider[] {
    const mockTelegramBot = {
      telegram: {
        sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
        editMessageText: jest.fn().mockResolvedValue({}),
        deleteMessage: jest.fn().mockResolvedValue({}),
        getMe: jest.fn().mockResolvedValue({ id: 123, username: 'test_bot' }),
      },
      launch: jest.fn().mockResolvedValue(true),
      stop: jest.fn().mockResolvedValue(true),
      use: jest.fn(),
      on: jest.fn(),
      command: jest.fn(),
      hears: jest.fn(),
    };
    
    return [
      {
        provide: 'TELEGRAF_TOKEN',
        useValue: 'test-telegram-token',
      },
      {
        provide: 'TelegramBot',
        useValue: mockTelegramBot,
      }
    ];
  }

  /**
   * Создает провайдеры для модуля валидации
   * @returns Provider[] для ValidationModule
   */
  static createValidationProviderMocks(): Provider[] {
    const mockValidationService = {
      validate: jest.fn().mockResolvedValue({ isValid: true, errors: [] }),
      validateMany: jest.fn().mockResolvedValue({ isValid: true, errors: [] }),
      validateWithFn: jest.fn().mockResolvedValue({ isValid: true, errors: [] }),
      validateRequest: jest.fn().mockResolvedValue({ isValid: true, errors: [] }),
      sanitizeInput: jest.fn((input) => {
        if (typeof input === 'string') {
          return input.replace(/<[^>]*>/g, '');
        }
        return input;
      }),
      getValidationRules: jest.fn().mockReturnValue({
        message: {},
        character: {},
      }),
    };

    const mockValidationErrorHandlerService = {
      handleValidationResult: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      handleBatchValidationResults: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      handleValidationError: jest.fn().mockReturnValue({ type: 'validation-error', message: 'Test error' }),
      createCustomValidationError: jest.fn().mockReturnValue({ type: 'custom-error', message: 'Custom error' }),
    };

    return [
      {
        provide: 'ValidationService',
        useValue: mockValidationService,
      },
      {
        provide: 'ValidationErrorHandlerService',
        useValue: mockValidationErrorHandlerService,
      }
    ];
  }
} 
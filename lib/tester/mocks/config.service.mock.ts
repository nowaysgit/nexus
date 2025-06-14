import { Provider } from '@nestjs/common';

/**
 * Мок для ConfigService
 */
export const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    // Конфигурация для Telegram
    if (key === 'telegram') {
      return {
        token: 'test-telegram-token',
        webhook: {
          enabled: false,
          domain: 'test.domain',
          path: '/webhook',
        },
      };
    }
    
    // Конфигурация для Rollbar
    if (key === 'logging.rollbar') {
      return {
        enabled: false,
        accessToken: 'test-rollbar-token',
        environment: 'test',
        captureUncaught: false,
        captureUnhandledRejections: false,
      };
    }
    
    // Конфигурация для LLM
    if (key === 'llm') {
      return {
        defaultProvider: 'openai',
        openai: {
          apiKey: 'test-openai-key',
          model: 'gpt-3.5-turbo',
        },
        llama: {
          endpoint: 'http://localhost:8080',
        },
      };
    }
    
    // Общая конфигурация
    if (key === 'app') {
      return {
        name: 'nexus-test',
        env: 'test',
        port: 3000,
        debug: true,
      };
    }
    
    // Для JWT
    if (key === 'jwt') {
      return {
        secret: 'test-jwt-secret',
        expiresIn: '1h',
      };
    }
    
    // Возвращаем null для неизвестных ключей
    return null;
  }),
};

/**
 * Провайдер для ConfigService, который можно использовать в тестах
 */
export const ConfigServiceProvider: Provider = {
  provide: 'ConfigService',
  useValue: mockConfigService,
}; 
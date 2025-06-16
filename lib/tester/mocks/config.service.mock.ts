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
        launchMode: 'polling',
        webhookUrl: 'https://example.com/webhook',
        webhookPath: '/webhook',
        maxMessageLength: 20,
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

    // API ключи для ApiKeyService
    if (key === 'api.key') {
      console.log('[MockConfigService] get api.key');

      return 'client-test-api-key';
    }

    if (key === 'admin.apiKey') {
      console.log('[MockConfigService] get admin.apiKey');
      return 'admin-test-api-key';
    }

    if (key === 'security.apiKey') {
      console.log('[MockConfigService] get security.apiKey');
      return 'test-api-key';
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

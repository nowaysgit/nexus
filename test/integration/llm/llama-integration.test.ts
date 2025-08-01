import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlamaProviderService } from '../../../src/llm/providers/llama-provider.service';
import { LogService } from '../../../src/logging/log.service';
import {
  LLMProviderType,
  LLMMessageRole,
  ILLMMessage,
} from '../../../src/common/interfaces/llm-provider.interface';

/**
 * Integration тесты для LlamaProviderService с реальным локальным LLM
 * Требует запущенный Ollama сервер на localhost:11434 с моделью llama3.2
 *
 * Запуск:
 * 1. docker-compose -f docker-compose.llm.yml up -d
 * 2. yarn test:integration --testNamePattern="LlamaProviderService Integration"
 */
describe('LlamaProviderService Integration Tests', () => {
  let service: LlamaProviderService;
  let logService: LogService;

  // Флаг для пропуска тестов если LLM недоступен
  let isLLMAvailable = false;

  beforeAll(async () => {
    // Проверяем доступность локального LLM перед запуском тестов
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      isLLMAvailable = response.ok;
    } catch (_error) {
      console.warn('⚠️ Локальный LLM недоступен. Интеграционные тесты будут пропущены.');
      isLLMAvailable = false;
    }
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlamaProviderService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              endpoint: 'http://localhost:11434', // Используем стандартный Ollama порт
              apiKey: '',
              model: 'llama3.2',
              timeout: 60000,
            }),
          },
        },
        {
          provide: LogService,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LlamaProviderService>(LlamaProviderService);
    logService = module.get<LogService>(LogService);
  });

  describe('Real LLM Integration', () => {
    it('should check availability of local Llama server', async () => {
      if (!isLLMAvailable) {
        console.log('🏃‍♂️ Пропускаем тест - LLM сервер недоступен');
        return;
      }

      const isAvailable = await service.checkAvailability();
      expect(isAvailable).toBe(true);
    }, 30000);

    it('should generate real text response', async () => {
      if (!isLLMAvailable) {
        console.log('🏃‍♂️ Пропускаем тест - LLM сервер недоступен');
        return;
      }

      const messages: ILLMMessage[] = [
        {
          role: LLMMessageRole.USER,
          content: 'Say "Hello from Llama!" in exactly 3 words.',
        },
      ];

      const result = await service.generateText(messages, {
        maxTokens: 10,
        temperature: 0, // Детерминированный ответ
      });

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(typeof result.text).toBe('string');
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.requestInfo).toBeDefined();
      expect(result.requestInfo?.totalTokens).toBeGreaterThan(0);

      console.log('🤖 LLM Response:', result.text);
    }, 45000);

    it('should handle multiple message conversation', async () => {
      if (!isLLMAvailable) {
        console.log('🏃‍♂️ Пропускаем тест - LLM сервер недоступен');
        return;
      }

      const messages: ILLMMessage[] = [
        {
          role: LLMMessageRole.SYSTEM,
          content: 'You are a helpful assistant. Always respond with exactly one word.',
        },
        {
          role: LLMMessageRole.USER,
          content: 'What is the capital of France?',
        },
      ];

      const result = await service.generateText(messages, {
        maxTokens: 5,
        temperature: 0,
      });

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text.toLowerCase()).toContain('paris');

      console.log('🗺️ Geography Response:', result.text);
    }, 45000);

    it('should generate JSON response', async () => {
      if (!isLLMAvailable) {
        console.log('🏃‍♂️ Пропускаем тест - LLM сервер недоступен');
        return;
      }

      const messages: ILLMMessage[] = [
        {
          role: LLMMessageRole.USER,
          content: 'Return a JSON object with key "test" and value "success"',
        },
      ];

      const result = await service.generateJSON(messages, {
        maxTokens: 20,
        temperature: 0,
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('object');
      expect(result.data).toHaveProperty('test', 'success');

      console.log('📋 JSON Response:', result.data);
    }, 45000);

    it('should handle error responses gracefully', async () => {
      if (!isLLMAvailable) {
        console.log('🏃‍♂️ Пропускаем тест - LLM сервер недоступен');
        return;
      }

      // Создаем сервис с некорректной конфигурацией
      const testModule: TestingModule = await Test.createTestingModule({
        providers: [
          LlamaProviderService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue({
                endpoint: 'http://localhost:99999', // Некорректный порт
                apiKey: '',
                model: 'non-existent-model',
                timeout: 5000,
              }),
            },
          },
          {
            provide: LogService,
            useValue: logService,
          },
        ],
      }).compile();

      const errorService = testModule.get<LlamaProviderService>(LlamaProviderService);

      const messages: ILLMMessage[] = [
        {
          role: LLMMessageRole.USER,
          content: 'This should fail',
        },
      ];

      await expect(errorService.generateText(messages)).rejects.toThrow();
    }, 30000);

    it('should provide correct provider info', async () => {
      const info = service.getProviderInfo();

      expect(info).toBeDefined();
      expect(info.type).toBe(LLMProviderType.LLAMA);
      expect(info.name).toBe('Llama 3.2');
      expect(info.models.some(model => model.includes('llama3.2'))).toBe(true);
      expect(info.features).toContain('text_generation');
      expect(info.features).toContain('json_generation');
    });

    it('should estimate tokens approximately', () => {
      const text = 'This is a test message for token estimation.';
      const estimatedTokens = service.estimateTokens(text);

      expect(estimatedTokens).toBeGreaterThan(0);
      expect(estimatedTokens).toBeLessThan(50); // Разумная оценка для короткого текста
    });
  });

  describe('Performance Tests', () => {
    it('should respond within acceptable time limits', async () => {
      if (!isLLMAvailable) {
        console.log('🏃‍♂️ Пропускаем тест - LLM сервер недоступен');
        return;
      }

      const startTime = Date.now();

      const messages: ILLMMessage[] = [
        {
          role: LLMMessageRole.USER,
          content: 'Quick response test',
        },
      ];

      await service.generateText(messages, {
        maxTokens: 5,
        temperature: 0,
      });

      const responseTime = Date.now() - startTime;

      // Облегченная модель должна отвечать быстро (менее 30 секунд)
      expect(responseTime).toBeLessThan(30000);

      console.log(`⚡ Response time: ${responseTime}ms`);
    }, 35000);

    it('should handle concurrent requests', async () => {
      if (!isLLMAvailable) {
        console.log('🏃‍♂️ Пропускаем тест - LLM сервер недоступен');
        return;
      }

      const messages: ILLMMessage[] = [
        {
          role: LLMMessageRole.USER,
          content: 'Concurrent test',
        },
      ];

      const promises = Array.from({ length: 3 }, () =>
        service.generateText(messages, {
          maxTokens: 5,
          temperature: 0,
        }),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.text).toBeDefined();
        expect(result.text.length).toBeGreaterThan(0);
      });

      console.log('🔥 Concurrent requests completed successfully');
    }, 60000);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlamaProviderService } from '../../src/llm/providers/llama-provider.service';
import { LogService } from '../../src/logging/log.service';
import {
  LLMProviderType,
  LLMMessageRole,
} from '../../src/common/interfaces/llm-provider.interface';
import axios, { AxiosInstance } from 'axios';

// Мокаем axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('LlamaProviderService', () => {
  let service: LlamaProviderService;
  let _configService: jest.Mocked<ConfigService>;
  let logService: jest.Mocked<LogService>;
  let mockHttpClient: jest.Mocked<Pick<AxiosInstance, 'post' | 'get'>>;

  beforeEach(async () => {
    // Создаем мок HTTP клиента
    mockHttpClient = {
      post: jest.fn(),
      get: jest.fn(),
    };

    // Мокаем axios.create
    mockedAxios.create = jest.fn().mockReturnValue(mockHttpClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlamaProviderService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              endpoint: 'http://test-llama-endpoint:8080',
              apiKey: 'test-api-key',
              model: 'llama-4-70b',
              timeout: 5000,
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
    _configService = module.get(ConfigService);
    logService = module.get(LogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('должен инициализироваться с конфигурацией по умолчанию', () => {
      expect(service).toBeDefined();
      expect(service.providerType).toBe(LLMProviderType.LLAMA);
      expect(service.providerName).toBe('Llama 4');
      expect(logService.setContext).toHaveBeenCalledWith('LlamaProviderService');
      expect(mockedAxios.create).toHaveBeenCalled();
    });

    it('должен использовать конфигурацию из ConfigService', async () => {
      const llamaConfig = {
        endpoint: 'http://test-endpoint:8080',
        apiKey: 'test-api-key',
        model: 'test-model',
        timeout: 10000,
      };

      const mockConfigService = {
        get: jest.fn().mockReturnValue(llamaConfig),
      };

      // Пересоздаем сервис с новой конфигурацией
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LlamaProviderService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
          {
            provide: LogService,
            useValue: logService,
          },
        ],
      }).compile();

      const _newService = module.get<LlamaProviderService>(LlamaProviderService);

      expect(mockConfigService.get).toHaveBeenCalledWith('llm.providers.llama');
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: llamaConfig.endpoint,
        timeout: llamaConfig.timeout,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${llamaConfig.apiKey}`,
        },
      });
    });
  });

  describe('checkAvailability', () => {
    it('должен возвращать true при успешном тестовом запросе', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama-4-70b',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Test response',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 2,
            total_tokens: 7,
          },
        },
      };

      mockHttpClient.post.mockResolvedValue(mockResponse);

      const result = await service.checkAvailability();

      expect(result).toBe(true);
      expect(mockHttpClient.post).toHaveBeenCalledWith('/v1/chat/completions', expect.any(Object));
    });

    it('должен возвращать false при ошибке API', async () => {
      mockHttpClient.post.mockRejectedValue(new Error('API недоступен'));

      const result = await service.checkAvailability();

      expect(result).toBe(false);
      expect(logService.warn).toHaveBeenCalledWith('Llama API недоступен', expect.any(Object));
    });
  });

  describe('generateText', () => {
    const mockResponse = {
      data: {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama-4-70b',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Тестовый ответ от Llama',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      },
    };

    it('должен успешно генерировать текст', async () => {
      mockHttpClient.post.mockResolvedValue(mockResponse);

      const messages = [{ role: LLMMessageRole.USER, content: 'Тестовое сообщение' }];

      const result = await service.generateText(messages);

      expect(result.text).toBe('Тестовый ответ от Llama');
      expect(result.requestInfo).toBeDefined();
      expect(typeof result.requestInfo.requestId).toBe('string');
      expect(result.requestInfo.fromCache).toBe(false);
      expect(typeof result.requestInfo.executionTime).toBe('number');
      expect(result.requestInfo.model).toBe('llama-4-70b');
      expect(result.requestInfo.promptTokens).toBe(10);
      expect(result.requestInfo.completionTokens).toBe(5);
      expect(result.requestInfo.totalTokens).toBe(15);

      expect(mockHttpClient.post).toHaveBeenCalledWith('/v1/chat/completions', {
        model: 'llama-4-70b',
        messages: [
          {
            role: 'user',
            content: 'Тестовое сообщение',
          },
        ],
        temperature: undefined,
        max_tokens: undefined,
        top_p: undefined,
        frequency_penalty: undefined,
        presence_penalty: undefined,
        stream: false,
      });
    });

    it('должен использовать переданные опции', async () => {
      mockHttpClient.post.mockResolvedValue(mockResponse);

      const messages = [{ role: LLMMessageRole.USER, content: 'Тестовое сообщение' }];

      const options = {
        model: 'custom-model',
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2,
      };

      await service.generateText(messages, options);

      expect(mockHttpClient.post).toHaveBeenCalledWith('/v1/chat/completions', {
        model: 'custom-model',
        messages: [
          {
            role: 'user',
            content: 'Тестовое сообщение',
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.2,
        stream: false,
      });
    });

    it('должен выбрасывать ошибку при неправильном endpoint', async () => {
      // Создаем новый сервис с некорректным endpoint
      const mockConfigWithBadEndpoint = {
        get: jest.fn().mockReturnValue({
          endpoint: 'http://localhost:8080',
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LlamaProviderService,
          {
            provide: ConfigService,
            useValue: mockConfigWithBadEndpoint,
          },
          {
            provide: LogService,
            useValue: logService,
          },
        ],
      }).compile();

      const testService = module.get<LlamaProviderService>(LlamaProviderService);

      const messages = [{ role: LLMMessageRole.USER, content: 'Тестовое сообщение' }];

      await expect(testService.generateText(messages)).rejects.toThrow(
        'Llama API endpoint не настроен. Проверьте настройки LLM_LLAMA_ENDPOINT.',
      );
    });

    it('должен обрабатывать ошибки API', async () => {
      mockHttpClient.post.mockRejectedValue(new Error('Ошибка API'));

      const messages = [{ role: LLMMessageRole.USER, content: 'Тестовое сообщение' }];

      await expect(service.generateText(messages)).rejects.toThrow('Ошибка API');
    });
  });

  describe('generateJSON', () => {
    it('должен генерировать JSON ответ', async () => {
      const mockJsonResponse = {
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama-4-70b',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: '{"name": "test", "value": 123}',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        },
      };

      mockHttpClient.post.mockResolvedValue(mockJsonResponse);

      const messages = [{ role: LLMMessageRole.USER, content: 'Верни JSON' }];

      const result = await service.generateJSON(messages);

      expect(result.data).toEqual({ name: 'test', value: 123 });
      expect(result.requestInfo).toBeDefined();
      expect(typeof result.requestInfo.requestId).toBe('string');
      expect(result.requestInfo.fromCache).toBe(false);
      expect(typeof result.requestInfo.executionTime).toBe('number');
      expect(result.requestInfo.model).toBe('llama-4-70b');
      expect(result.requestInfo.promptTokens).toBe(10);
      expect(result.requestInfo.completionTokens).toBe(5);
      expect(result.requestInfo.totalTokens).toBe(15);
    });

    it('должен обрабатывать некорректный JSON', async () => {
      const mockInvalidJsonResponse = {
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama-4-70b',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Некорректный JSON',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        },
      };

      mockHttpClient.post.mockResolvedValue(mockInvalidJsonResponse);

      const messages = [{ role: LLMMessageRole.USER, content: 'Верни JSON' }];

      await expect(service.generateJSON(messages)).rejects.toThrow();
    });
  });

  describe('estimateTokens', () => {
    it('должен приблизительно оценивать количество токенов', () => {
      const text = 'Это тестовый текст для оценки токенов';
      const tokens = service.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    it('должен возвращать 0 для пустой строки', () => {
      const tokens = service.estimateTokens('');
      expect(tokens).toBe(0);
    });
  });

  describe('getProviderInfo', () => {
    it('должен возвращать информацию о провайдере', () => {
      const info = service.getProviderInfo();

      expect(info).toEqual({
        type: LLMProviderType.LLAMA,
        name: 'Llama 4',
        models: ['llama-4-70b', 'llama-4-13b', 'llama-4-7b', 'llama-4-instruct'],
        features: ['text_generation', 'json_generation', 'streaming', 'function_calling'],
      });
    });
  });
});

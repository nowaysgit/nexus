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
              endpoint: 'http://test-llama-endpoint:11434',
              apiKey: 'test-api-key',
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
      expect(service.providerName).toBe('Llama 3.2');
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
          models: [
            {
              name: 'llama3.2',
              modified_at: '2024-01-01T00:00:00Z',
              size: 1234567890,
              digest: 'sha256:abc123',
            },
          ],
        },
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const result = await service.checkAvailability();

      expect(result).toBe(true);
      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/tags');
    });

    it('должен возвращать false при ошибке API', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('API недоступен'));

      const result = await service.checkAvailability();

      expect(result).toBe(false);
      expect(logService.warn).toHaveBeenCalledWith('Ollama API недоступен', expect.any(Object));
    });
  });

  describe('generateText', () => {
    const mockResponse = {
      data: {
        model: 'llama3.2:latest',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Тестовый ответ от Llama',
        },
        done: true,
        total_duration: 1000000000,
        load_duration: 100000000,
        prompt_eval_count: 10,
        prompt_eval_duration: 200000000,
        eval_count: 5,
        eval_duration: 300000000,
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
      expect(result.requestInfo.model).toBe('llama3.2:latest');

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/chat', {
        model: 'llama3.2',
        messages: [
          {
            role: 'user',
            content: 'Тестовое сообщение',
          },
        ],
        options: {
          temperature: 0.7,
          num_predict: 1000,
          top_p: 0.9,
        },
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
      };

      await service.generateText(messages, options);

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/chat', {
        model: 'custom-model',
        messages: [
          {
            role: 'user',
            content: 'Тестовое сообщение',
          },
        ],
        options: {
          temperature: 0.7,
          num_predict: 100,
          top_p: 0.9,
        },
        stream: false,
      });
    });

    it('должен выбрасывать ошибку при неправильном endpoint', async () => {
      // Мокаем невалидный ответ от Ollama
      mockHttpClient.post.mockRejectedValue(new Error('ECONNREFUSED'));

      const messages = [{ role: LLMMessageRole.USER, content: 'Тестовое сообщение' }];

      await expect(service.generateText(messages)).rejects.toThrow('ECONNREFUSED');
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
          model: 'llama3.2:latest',
          created_at: '2024-01-01T00:00:00Z',
          message: {
            role: 'assistant',
            content: '{"name": "test", "value": 123}',
          },
          done: true,
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
      expect(result.requestInfo.model).toBe('llama3.2:latest');
    });

    it('должен обрабатывать некорректный JSON', async () => {
      const mockInvalidJsonResponse = {
        data: {
          model: 'llama3.2:latest',
          created_at: '2024-01-01T00:00:00Z',
          message: {
            role: 'assistant',
            content: 'Некорректный JSON',
          },
          done: true,
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

      expect(info.type).toBe(LLMProviderType.LLAMA);
      expect(info.name).toBe('Llama 3.2');
      expect(info.models.some(model => model.includes('llama3.2'))).toBe(true);
      expect(info.models.some(model => model.includes('llama3.3'))).toBe(true);
      expect(info.models.some(model => model.includes('llama3.1'))).toBe(true);
      expect(info.features).toEqual([
        'text_generation',
        'json_generation',
        'streaming',
        'function_calling',
      ]);
    });
  });
});

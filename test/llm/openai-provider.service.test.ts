import { Test, TestingModule } from '@nestjs/testing';
import { OpenAIProviderService } from '../../src/llm/providers/openai.provider.service';
import { OpenAICoreService } from '../../src/llm/providers/openai-core.service';
import { LogService } from '../../src/logging/log.service';
import {
  LLMProviderType,
  LLMMessageRole,
} from '../../src/common/interfaces/llm-provider.interface';

describe('OpenAIProviderService', () => {
  let service: OpenAIProviderService;
  let openaiCoreService: jest.Mocked<OpenAICoreService>;
  let logService: jest.Mocked<LogService>;

  beforeEach(async () => {
    const mockOpenAICoreService = {
      sendRequest: jest.fn(),
      generateEmbedding: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIProviderService,
        {
          provide: OpenAICoreService,
          useValue: mockOpenAICoreService,
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

    service = module.get<OpenAIProviderService>(OpenAIProviderService);
    openaiCoreService = module.get(OpenAICoreService);
    logService = module.get(LogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('должен инициализироваться с правильными параметрами', () => {
      expect(service).toBeDefined();
      expect(service.providerType).toBe(LLMProviderType.OPENAI);
      expect(service.providerName).toBe('OpenAI GPT');
      expect(logService.setContext).toHaveBeenCalledWith('OpenAIProviderService');
    });
  });

  describe('checkAvailability', () => {
    it('должен возвращать true при успешном тестовом запросе', async () => {
      openaiCoreService.sendRequest.mockResolvedValue('Test response');

      const result = await service.checkAvailability();

      expect(result).toBe(true);
      expect(openaiCoreService.sendRequest).toHaveBeenCalledWith(
        'gpt-4',
        [{ role: 'user', content: 'Test', name: undefined }],
        {
          temperature: 0,
          max_tokens: 5,
          parseJson: false,
          useCache: undefined,
          cacheTTL: undefined,
          retries: undefined,
          timeout: undefined,
          model: undefined,
          top_p: undefined,
          frequency_penalty: undefined,
          presence_penalty: undefined,
          seed: undefined,
        },
      );
    });

    it('должен возвращать false при ошибке API', async () => {
      openaiCoreService.sendRequest.mockRejectedValue(new Error('API недоступен'));

      const result = await service.checkAvailability();

      expect(result).toBe(false);
      expect(logService.warn).toHaveBeenCalledWith('OpenAI API недоступен', expect.any(Object));
    });
  });

  describe('generateText', () => {
    it('должен успешно генерировать текст', async () => {
      const mockResponse = 'Тестовый ответ от OpenAI';
      openaiCoreService.sendRequest.mockResolvedValue(mockResponse);

      const messages = [{ role: LLMMessageRole.USER, content: 'Тестовое сообщение' }];

      const result = await service.generateText(messages);

      expect(result.text).toBe(mockResponse);
      expect(result.requestInfo).toBeDefined();
      expect(typeof result.requestInfo.requestId).toBe('string');
      expect(result.requestInfo.fromCache).toBe(false);
      expect(typeof result.requestInfo.executionTime).toBe('number');
      expect(result.requestInfo.model).toBe('gpt-4');

      expect(openaiCoreService.sendRequest).toHaveBeenCalledWith(
        'gpt-4',
        [{ role: 'user', content: 'Тестовое сообщение', name: undefined }],
        {
          temperature: undefined,
          max_tokens: undefined,
          parseJson: false,
          useCache: undefined,
          cacheTTL: undefined,
          retries: undefined,
          timeout: undefined,
          model: undefined,
          top_p: undefined,
          frequency_penalty: undefined,
          presence_penalty: undefined,
          seed: undefined,
        },
      );
    });

    it('должен использовать переданные опции', async () => {
      const mockResponse = 'Тестовый ответ';
      openaiCoreService.sendRequest.mockResolvedValue(mockResponse);

      const messages = [{ role: LLMMessageRole.USER, content: 'Тестовое сообщение' }];

      const options = {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2,
      };

      await service.generateText(messages, options);

      expect(openaiCoreService.sendRequest).toHaveBeenCalledWith(
        'gpt-3.5-turbo',
        [{ role: 'user', content: 'Тестовое сообщение', name: undefined }],
        {
          temperature: 0.7,
          max_tokens: 100,
          parseJson: false,
          useCache: undefined,
          cacheTTL: undefined,
          retries: undefined,
          timeout: undefined,
          model: 'gpt-3.5-turbo',
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.2,
          seed: undefined,
        },
      );
    });

    it('должен обрабатывать ошибки API', async () => {
      openaiCoreService.sendRequest.mockRejectedValue(new Error('Ошибка API'));

      const messages = [{ role: LLMMessageRole.USER, content: 'Тестовое сообщение' }];

      await expect(service.generateText(messages)).rejects.toThrow('Ошибка API');
      expect(logService.error).toHaveBeenCalledWith(
        'Ошибка генерации текста через OpenAI',
        expect.any(Object),
      );
    });
  });

  describe('generateJSON', () => {
    it('должен генерировать JSON ответ', async () => {
      const mockJsonData = { name: 'test', value: 123 };
      openaiCoreService.sendRequest.mockResolvedValue(mockJsonData);

      const messages = [{ role: LLMMessageRole.USER, content: 'Верни JSON' }];

      const result = await service.generateJSON(messages);

      expect(result.data).toEqual(mockJsonData);
      expect(result.requestInfo).toBeDefined();
      expect(typeof result.requestInfo.requestId).toBe('string');
      expect(result.requestInfo.fromCache).toBe(false);
      expect(typeof result.requestInfo.executionTime).toBe('number');
      expect(result.requestInfo.model).toBe('gpt-4');

      expect(openaiCoreService.sendRequest).toHaveBeenCalledWith(
        'gpt-4',
        [{ role: 'user', content: 'Верни JSON', name: undefined }],
        {
          temperature: undefined,
          max_tokens: undefined,
          parseJson: true,
          useCache: undefined,
          cacheTTL: undefined,
          retries: undefined,
          timeout: undefined,
          model: undefined,
          top_p: undefined,
          frequency_penalty: undefined,
          presence_penalty: undefined,
          seed: undefined,
        },
      );
    });

    it('должен обрабатывать ошибки при генерации JSON', async () => {
      openaiCoreService.sendRequest.mockRejectedValue(new Error('Ошибка JSON'));

      const messages = [{ role: LLMMessageRole.USER, content: 'Верни JSON' }];

      await expect(service.generateJSON(messages)).rejects.toThrow('Ошибка JSON');
      expect(logService.error).toHaveBeenCalledWith(
        'Ошибка генерации JSON через OpenAI',
        expect.any(Object),
      );
    });
  });

  describe('generateTextStream', () => {
    it('должен выполнять потоковую генерацию текста', async () => {
      const mockResponse = 'Потоковый ответ';
      openaiCoreService.sendRequest.mockResolvedValue(mockResponse);

      const messages = [{ role: LLMMessageRole.USER, content: 'Тестовое сообщение' }];

      const callbacks = {
        onStart: jest.fn(),
        onProgress: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn(),
      };

      await service.generateTextStream(messages, callbacks);

      expect(callbacks.onStart).toHaveBeenCalled();
      expect(callbacks.onProgress).toHaveBeenCalledWith(mockResponse);
      expect(callbacks.onComplete).toHaveBeenCalledWith(mockResponse);
      expect(callbacks.onError).not.toHaveBeenCalled();
    });

    it('должен обрабатывать ошибки в потоковой генерации', async () => {
      const error = new Error('Ошибка стриминга');
      openaiCoreService.sendRequest.mockRejectedValue(error);

      const messages = [{ role: LLMMessageRole.USER, content: 'Тестовое сообщение' }];

      const callbacks = {
        onStart: jest.fn(),
        onProgress: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn(),
      };

      await expect(service.generateTextStream(messages, callbacks)).rejects.toThrow(
        'Ошибка стриминга',
      );
      expect(callbacks.onError).toHaveBeenCalledWith(error);
    });
  });

  describe('generateEmbedding', () => {
    it('должен генерировать векторное представление текста', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      openaiCoreService.generateEmbedding.mockResolvedValue(mockEmbedding);

      const text = 'Тестовый текст для эмбеддинга';

      const result = await service.generateEmbedding(text);

      expect(result).toEqual(mockEmbedding);
      expect(openaiCoreService.generateEmbedding).toHaveBeenCalledWith(text);
    });

    it('должен обрабатывать ошибки при генерации эмбеддинга', async () => {
      openaiCoreService.generateEmbedding.mockRejectedValue(new Error('Ошибка эмбеддинга'));

      const text = 'Тестовый текст';

      await expect(service.generateEmbedding(text)).rejects.toThrow('Ошибка эмбеддинга');
      expect(logService.error).toHaveBeenCalledWith(
        'Ошибка генерации эмбеддинга через OpenAI',
        expect.any(Object),
      );
    });
  });

  describe('estimateTokens', () => {
    it('должен приблизительно оценивать количество токенов', () => {
      const text = 'Это тестовый текст для оценки токенов';
      const tokens = service.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
      // Примерная оценка: 4 символа на токен
      expect(tokens).toBe(Math.ceil(text.length / 4));
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
        type: LLMProviderType.OPENAI,
        name: 'OpenAI GPT',
        models: ['gpt-4', 'gpt-4-32k', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'],
        features: ['text_generation', 'json_generation', 'streaming', 'function_calling', 'vision'],
      });
    });
  });
});

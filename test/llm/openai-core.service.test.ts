import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OpenAICoreService } from '../../src/llm/providers/openai-core.service';
import { LogService } from '../../src/logging/log.service';
import { CacheService } from '../../src/cache/cache.service';
import { MessageQueueService } from '../../src/message-queue/message-queue.service';
import { ChatMessage } from '../../src/common/interfaces/openai-types.interface';

// Мокаем OpenAI SDK
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
      embeddings: {
        create: jest.fn(),
      },
    })),
  };
});

describe('OpenAICoreService', () => {
  let service: OpenAICoreService;
  let configService: jest.Mocked<ConfigService>;
  let logService: jest.Mocked<LogService>;
  let cacheService: jest.Mocked<CacheService>;
  let messageQueueService: jest.Mocked<MessageQueueService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue({
        apiKey: 'test-api-key',
        organization: 'test-org',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2048,
        timeout: 30000,
        retries: 3,
      }),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockMessageQueueService = {
      enqueue: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAICoreService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
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
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: MessageQueueService,
          useValue: mockMessageQueueService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<OpenAICoreService>(OpenAICoreService);
    configService = module.get(ConfigService);
    logService = module.get(LogService);
    cacheService = module.get(CacheService);
    messageQueueService = module.get(MessageQueueService);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('должен инициализироваться с правильными параметрами', () => {
      expect(service).toBeDefined();
      expect(logService.setContext).toHaveBeenCalledWith('OpenAICoreService');
      expect(logService.log).toHaveBeenCalledWith(
        'LLM OpenAI Core сервис инициализирован',
        expect.objectContaining({
          model: 'gpt-4',
          hasApiKey: true,
          timeout: 30000,
          retries: 3,
        }),
      );
    });

    it('должен предупреждать о отсутствии API ключа', async () => {
      const mockConfigWithoutKey = {
        get: jest.fn().mockReturnValue({}),
      };

      // Временно удаляем переменную окружения
      const originalApiKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OpenAICoreService,
          {
            provide: ConfigService,
            useValue: mockConfigWithoutKey,
          },
          {
            provide: LogService,
            useValue: {
              setContext: jest.fn(),
              log: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
            },
          },
          {
            provide: CacheService,
            useValue: { get: jest.fn(), set: jest.fn() },
          },
          {
            provide: MessageQueueService,
            useValue: { enqueue: jest.fn() },
          },
          {
            provide: EventEmitter2,
            useValue: { emit: jest.fn() },
          },
        ],
      }).compile();

      const testService = module.get<OpenAICoreService>(OpenAICoreService);
      const testLogService = module.get<LogService>(LogService);

      expect(testLogService.warn).toHaveBeenCalledWith(
        'OpenAI API ключ не найден. Сервис будет работать в режиме заглушек.',
      );

      // Восстанавливаем переменную окружения
      if (originalApiKey) {
        process.env.OPENAI_API_KEY = originalApiKey;
      }
    });
  });

  describe('sendRequest', () => {
    const mockMessages: ChatMessage[] = [{ role: 'user', content: 'Тестовое сообщение' }];

    it('должен успешно отправлять запрос через очередь', async () => {
      const mockResponse = 'Тестовый ответ от OpenAI';

      // Мокаем enqueue чтобы он выполнил переданную функцию
      messageQueueService.enqueue.mockImplementation(async (context, handler) => {
        return await handler();
      });

      // Мокаем результат выполнения
      const mockHandler = jest.fn().mockResolvedValue(mockResponse);
      messageQueueService.enqueue.mockResolvedValue(mockResponse);

      const result = await service.sendRequest('gpt-4', mockMessages);

      expect(result).toBe(mockResponse);
      expect(messageQueueService.enqueue).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'monitoring.event',
        expect.objectContaining({
          type: 'request_start',
          model: 'gpt-4',
        }),
      );
    });

    it('должен использовать кэш если он доступен', async () => {
      const cachedResult = 'Кэшированный результат';
      cacheService.get.mockResolvedValue(cachedResult);

      const result = await service.sendRequest('gpt-4', mockMessages, { useCache: true });

      expect(result).toBe(cachedResult);
      expect(cacheService.get).toHaveBeenCalled();
      expect(messageQueueService.enqueue).not.toHaveBeenCalled();
      expect(logService.debug).toHaveBeenCalledWith('Использован кэшированный результат запроса');
    });

    it('должен пропускать кэш если useCache = false', async () => {
      const mockResponse = 'Ответ без кэша';
      messageQueueService.enqueue.mockResolvedValue(mockResponse);

      const result = await service.sendRequest('gpt-4', mockMessages, { useCache: false });

      expect(cacheService.get).not.toHaveBeenCalled();
      expect(messageQueueService.enqueue).toHaveBeenCalled();
    });

    it('должен обрабатывать ошибки API', async () => {
      const apiError = new Error('API Error');
      messageQueueService.enqueue.mockRejectedValue(apiError);

      await expect(service.sendRequest('gpt-4', mockMessages)).rejects.toThrow('API Error');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'monitoring.event',
        expect.objectContaining({
          type: 'request_start',
        }),
      );
    });
  });

  describe('generateText', () => {
    it('должен генерировать текст с правильными параметрами', async () => {
      const mockResponse = 'Сгенерированный текст';
      messageQueueService.enqueue.mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [{ role: 'user', content: 'Напиши текст' }];

      const result = await service.generateText(messages, { temperature: 0.5 });

      expect(result).toEqual({
        text: mockResponse,
        requestInfo: expect.objectContaining({
          requestId: expect.any(String),
          fromCache: false,
          executionTime: expect.any(Number),
        }),
      });
    });
  });

  describe('generateJSON', () => {
    it('должен генерировать JSON с правильными параметрами', async () => {
      const mockJsonData = { name: 'test', value: 123 };
      messageQueueService.enqueue.mockResolvedValue(mockJsonData);

      const messages: ChatMessage[] = [{ role: 'user', content: 'Верни JSON' }];

      const result = await service.generateJSON(messages, { parseJson: true });

      expect(result).toEqual({
        data: mockJsonData,
        requestInfo: expect.objectContaining({
          requestId: expect.any(String),
          fromCache: false,
          executionTime: expect.any(Number),
        }),
      });
    });
  });

  describe('generateEmbedding', () => {
    it('должен генерировать эмбеддинг для текста', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      messageQueueService.enqueue.mockResolvedValue(mockEmbedding);

      const text = 'Тестовый текст для эмбеддинга';

      const result = await service.generateEmbedding(text);

      expect(result).toEqual(mockEmbedding);
      expect(messageQueueService.enqueue).toHaveBeenCalled();
    });

    it('должен использовать пользовательскую модель для эмбеддинга', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      messageQueueService.enqueue.mockResolvedValue(mockEmbedding);

      const text = 'Тестовый текст';
      const customModel = 'text-embedding-3-small';

      const result = await service.generateEmbedding(text, customModel);

      expect(result).toEqual(mockEmbedding);
      expect(messageQueueService.enqueue).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('должен корректно освобождать ресурсы', async () => {
      await service.onModuleDestroy();

      expect(logService.log).toHaveBeenCalledWith('Освобождение ресурсов LLM OpenAI Core Service');
    });
  });
});

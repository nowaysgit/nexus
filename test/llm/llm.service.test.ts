import { Test, TestingModule } from '@nestjs/testing';
import { LLMService } from '../../src/llm/services/llm.service';
import { LLMProviderManagerService } from '../../src/llm/services/llm-provider-manager.service';
import { CacheService } from '../../src/cache/cache.service';
import { LogService } from '../../src/logging/log.service';
import {
  ILLMMessage,
  ILLMRequestOptions,
  ILLMTextResult,
  ILLMJsonResult,
  ILLMStreamCallbacks,
  LLMMessageRole,
  LLMProviderType,
  ILLMProvider,
} from '../../src/common/interfaces/llm-provider.interface';

describe('LLMService', () => {
  let service: LLMService;
  let providerManager: jest.Mocked<LLMProviderManagerService>;
  let cacheService: jest.Mocked<CacheService>;
  let logService: jest.Mocked<LogService>;
  let mockProvider: jest.Mocked<ILLMProvider>;

  const mockTextResult: ILLMTextResult = {
    text: 'Test response',
    requestInfo: {
      requestId: 'test-req-123',
      fromCache: false,
      executionTime: 1000,
      model: 'gpt-4',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    },
  };

  const mockJsonResult: ILLMJsonResult<{ test: string }> = {
    data: { test: 'value' },
    requestInfo: mockTextResult.requestInfo,
  };

  const mockMessages: ILLMMessage[] = [{ role: LLMMessageRole.USER, content: 'Test message' }];

  const mockOptions: ILLMRequestOptions = {
    temperature: 0.7,
    maxTokens: 100,
  };

  beforeEach(async () => {
    // Создаем мок провайдера
    mockProvider = {
      providerType: LLMProviderType.OPENAI,
      providerName: 'OpenAI Test',
      generateText: jest.fn(),
      generateJSON: jest.fn(),
      generateTextStream: jest.fn(),
      generateEmbedding: jest.fn(),
      checkAvailability: jest.fn(),
      estimateTokens: jest.fn(),
      getProviderInfo: jest.fn(),
    };

    // Создаем моки сервисов
    const mockProviderManager = {
      getActiveProvider: jest.fn(),
      setActiveProvider: jest.fn(),
      registerProvider: jest.fn(),
      getAllProviders: jest.fn(),
      checkAllProvidersAvailability: jest.fn(),
      getManagerInfo: jest.fn(),
      selectBestAvailableProvider: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      has: jest.fn(),
      keys: jest.fn(),
      getStats: jest.fn(),
      getInfo: jest.fn(),
    };

    const mockLogService = {
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMService,
        { provide: LLMProviderManagerService, useValue: mockProviderManager },
        { provide: CacheService, useValue: mockCacheService },
        { provide: LogService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<LLMService>(LLMService);
    providerManager = module.get(LLMProviderManagerService);
    cacheService = module.get(CacheService);
    logService = module.get(LogService);

    // Настраиваем мок провайдера
    mockProvider.getProviderInfo.mockReturnValue({
      type: LLMProviderType.OPENAI,
      name: 'OpenAI Test',
      models: ['gpt-3.5-turbo'],
      features: ['text', 'json'],
    });
    providerManager.getActiveProvider.mockReturnValue(mockProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('generateText', () => {
    it('should generate text successfully', async () => {
      mockProvider.generateText.mockResolvedValue(mockTextResult);
      cacheService.get.mockResolvedValue(null);

      const result = await service.generateText(mockMessages, mockOptions);

      expect(result).toEqual(mockTextResult);
      expect(mockProvider.generateText).toHaveBeenCalledWith(mockMessages, mockOptions);
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should return cached result when available', async () => {
      const cachedResult = {
        ...mockTextResult,
        requestInfo: { ...mockTextResult.requestInfo, fromCache: true },
      };
      cacheService.get.mockResolvedValue(cachedResult);

      const result = await service.generateText(mockMessages, mockOptions);

      expect(result.requestInfo.fromCache).toBe(true);
      expect(mockProvider.generateText).not.toHaveBeenCalled();
      expect(cacheService.get).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Provider error');
      mockProvider.generateText.mockRejectedValue(error);
      cacheService.get.mockResolvedValue(null);

      await expect(service.generateText(mockMessages, mockOptions)).rejects.toThrow(error);
    });
  });

  describe('generateJSON', () => {
    it('should generate JSON successfully', async () => {
      mockProvider.generateJSON.mockResolvedValue(mockJsonResult);
      cacheService.get.mockResolvedValue(null);

      const result = await service.generateJSON<{ test: string }>(mockMessages, mockOptions);

      expect(result).toEqual(mockJsonResult);
      expect(mockProvider.generateJSON).toHaveBeenCalledWith(mockMessages, mockOptions);
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should return cached JSON result when available', async () => {
      const cachedResult = {
        ...mockJsonResult,
        requestInfo: { ...mockJsonResult.requestInfo, fromCache: true },
      };
      cacheService.get.mockResolvedValue(cachedResult);

      const result = await service.generateJSON<{ test: string }>(mockMessages, mockOptions);

      expect(result.requestInfo.fromCache).toBe(true);
      expect(mockProvider.generateJSON).not.toHaveBeenCalled();
    });

    it('should handle JSON generation errors', async () => {
      const error = new Error('JSON generation error');
      mockProvider.generateJSON.mockRejectedValue(error);
      cacheService.get.mockResolvedValue(null);

      await expect(service.generateJSON(mockMessages, mockOptions)).rejects.toThrow(error);
    });
  });

  describe('generateTextStream', () => {
    it('should stream text successfully', async () => {
      const callbacks: ILLMStreamCallbacks = {
        onStart: jest.fn(),
        onProgress: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn(),
      };

      mockProvider.generateTextStream.mockResolvedValue(undefined);

      await service.generateTextStream(mockMessages, callbacks, mockOptions);

      expect(mockProvider.generateTextStream).toHaveBeenCalledWith(
        mockMessages,
        callbacks,
        mockOptions,
      );
    });

    it('should handle streaming errors', async () => {
      const callbacks: ILLMStreamCallbacks = {
        onStart: jest.fn(),
        onProgress: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn(),
      };

      const error = new Error('Streaming error');
      mockProvider.generateTextStream.mockRejectedValue(error);

      await expect(
        service.generateTextStream(mockMessages, callbacks, mockOptions),
      ).rejects.toThrow(error);
    });
  });

  describe('checkAvailability', () => {
    it('should return true when provider is available', async () => {
      mockProvider.checkAvailability.mockResolvedValue(true);

      const result = await service.checkAvailability();

      expect(result).toBe(true);
      expect(mockProvider.checkAvailability).toHaveBeenCalled();
    });

    it('should return false when provider is unavailable', async () => {
      mockProvider.checkAvailability.mockResolvedValue(false);

      const result = await service.checkAvailability();

      expect(result).toBe(false);
    });

    it('should return false when check throws error', async () => {
      mockProvider.checkAvailability.mockRejectedValue(new Error('Check failed'));

      const result = await service.checkAvailability();

      expect(result).toBe(false);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      mockProvider.estimateTokens.mockReturnValue(10);

      const result = service.estimateTokens('test text');

      expect(result).toBe(10);
      expect(mockProvider.estimateTokens).toHaveBeenCalledWith('test text');
    });
  });

  describe('getActiveProviderInfo', () => {
    it('should return active provider info', () => {
      const providerInfo = {
        type: LLMProviderType.OPENAI,
        name: 'OpenAI',
        models: ['gpt-4'],
        features: ['text_generation'],
      };

      mockProvider.getProviderInfo.mockReturnValue(providerInfo);

      const result = service.getActiveProviderInfo();

      expect(result).toEqual(providerInfo);
      expect(mockProvider.getProviderInfo).toHaveBeenCalled();
    });
  });

  describe('getProvidersInfo', () => {
    it('should return providers info from manager', () => {
      const managersInfo = {
        activeProvider: LLMProviderType.OPENAI,
        registeredProviders: [LLMProviderType.OPENAI],
        providersInfo: [
          {
            type: LLMProviderType.OPENAI,
            name: 'OpenAI',
            models: ['gpt-4'],
            features: ['text_generation'],
          },
        ],
      };

      providerManager.getManagerInfo.mockReturnValue(managersInfo);

      const result = service.getProvidersInfo();

      expect(result).toEqual(managersInfo);
      expect(providerManager.getManagerInfo).toHaveBeenCalled();
    });
  });

  describe('checkAllProvidersAvailability', () => {
    it('should check all providers availability', async () => {
      const availability = {
        [LLMProviderType.OPENAI]: true,
        [LLMProviderType.LLAMA]: false,
        [LLMProviderType.CLAUDE]: false,
        [LLMProviderType.GEMINI]: false,
        [LLMProviderType.CUSTOM]: false,
      };

      providerManager.checkAllProvidersAvailability.mockResolvedValue(availability);

      const result = await service.checkAllProvidersAvailability();

      expect(result).toEqual(availability);
      expect(providerManager.checkAllProvidersAvailability).toHaveBeenCalled();
    });
  });

  describe('selectBestProvider', () => {
    it('should select best available provider', async () => {
      providerManager.selectBestAvailableProvider.mockResolvedValue(LLMProviderType.OPENAI);

      const result = await service.selectBestProvider();

      expect(result).toBe(LLMProviderType.OPENAI);
      expect(providerManager.selectBestAvailableProvider).toHaveBeenCalled();
    });
  });

  describe('private methods', () => {
    it('should create cache key correctly', () => {
      // Тестируем приватный метод через публичный интерфейс
      const spy = jest.spyOn(cacheService, 'get');

      service.generateText(mockMessages, mockOptions);

      expect(spy).toHaveBeenCalledWith(expect.any(String));
    });
  });
});

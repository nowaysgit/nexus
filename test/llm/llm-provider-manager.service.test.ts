import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LLMProviderManagerService } from '../../src/llm/services/llm-provider-manager.service';
import { LogService } from '../../src/logging/log.service';
import { ILLMProvider, LLMProviderType } from '../../src/common/interfaces/llm-provider.interface';

describe('LLMProviderManagerService', () => {
  let service: LLMProviderManagerService;
  let configService: jest.Mocked<ConfigService>;
  let logService: jest.Mocked<LogService>;
  let mockOpenAIProvider: jest.Mocked<ILLMProvider>;
  let mockLlamaProvider: jest.Mocked<ILLMProvider>;

  beforeEach(async () => {
    // Создаем мок провайдеров
    mockOpenAIProvider = {
      providerType: LLMProviderType.OPENAI,
      providerName: 'OpenAI Test',
      generateText: jest.fn(),
      generateJSON: jest.fn(),
      generateTextStream: jest.fn(),
      generateEmbedding: jest.fn(),
      checkAvailability: jest.fn(),
      estimateTokens: jest.fn(),
      getProviderInfo: jest.fn().mockReturnValue({
        type: LLMProviderType.OPENAI,
        name: 'OpenAI Test',
        models: ['gpt-4'],
        features: ['text_generation'],
      }),
    };

    mockLlamaProvider = {
      providerType: LLMProviderType.LLAMA,
      providerName: 'Llama Test',
      generateText: jest.fn(),
      generateJSON: jest.fn(),
      generateTextStream: jest.fn(),
      generateEmbedding: jest.fn(),
      checkAvailability: jest.fn(),
      estimateTokens: jest.fn(),
      getProviderInfo: jest.fn().mockReturnValue({
        type: LLMProviderType.LLAMA,
        name: 'Llama Test',
        models: ['llama-4-70b'],
        features: ['text_generation'],
      }),
    };

    // Создаем моки сервисов
    const mockConfigService = {
      get: jest.fn(),
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
        LLMProviderManagerService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LogService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<LLMProviderManagerService>(LLMProviderManagerService);
    configService = module.get(ConfigService);
    logService = module.get(LogService);

    // Настраиваем мок конфигурации
    configService.get.mockReturnValue(LLMProviderType.OPENAI);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with active provider from config', () => {
      expect(configService.get).toHaveBeenCalledWith('llm.activeProvider', LLMProviderType.LLAMA);
      expect(logService.setContext).toHaveBeenCalledWith('LLMProviderManagerService');
    });
  });

  describe('registerProvider', () => {
    it('should register a provider successfully', () => {
      service.registerProvider(mockOpenAIProvider);

      expect(logService.log).toHaveBeenCalledWith(
        `Зарегистрирован провайдер: ${mockOpenAIProvider.providerName} (${mockOpenAIProvider.providerType})`,
      );
    });

    it('should warn when registering duplicate provider', () => {
      service.registerProvider(mockOpenAIProvider);
      service.registerProvider(mockOpenAIProvider);

      expect(logService.warn).toHaveBeenCalledWith(
        `Провайдер ${mockOpenAIProvider.providerType} уже зарегистрирован, заменяю на новый`,
      );
    });
  });

  describe('getActiveProvider', () => {
    it('should return active provider when registered', () => {
      service.registerProvider(mockOpenAIProvider);

      const activeProvider = service.getActiveProvider();

      expect(activeProvider).toBe(mockOpenAIProvider);
    });

    it('should throw error when active provider not registered', () => {
      expect(() => {
        service.getActiveProvider();
      }).toThrow(/Активный провайдер .* не зарегистрирован/);
    });
  });

  describe('setActiveProvider', () => {
    it('should set active provider successfully', () => {
      service.registerProvider(mockOpenAIProvider);
      service.registerProvider(mockLlamaProvider);

      service.setActiveProvider(LLMProviderType.LLAMA);

      const activeProvider = service.getActiveProvider();
      expect(activeProvider).toBe(mockLlamaProvider);
      expect(logService.log).toHaveBeenCalledWith(
        `Активный провайдер изменен с ${LLMProviderType.OPENAI} на ${LLMProviderType.LLAMA}`,
      );
    });

    it('should throw error when setting unregistered provider', () => {
      expect(() => {
        service.setActiveProvider(LLMProviderType.CLAUDE);
      }).toThrow(`Провайдер ${LLMProviderType.CLAUDE} не зарегистрирован`);
    });
  });

  describe('getAllProviders', () => {
    it('should return all registered providers', () => {
      service.registerProvider(mockOpenAIProvider);
      service.registerProvider(mockLlamaProvider);

      const providers = service.getAllProviders();

      expect(providers).toHaveLength(2);
      expect(providers).toContain(mockOpenAIProvider);
      expect(providers).toContain(mockLlamaProvider);
    });

    it('should return empty array when no providers registered', () => {
      const providers = service.getAllProviders();

      expect(providers).toEqual([]);
    });
  });

  describe('checkAllProvidersAvailability', () => {
    it('should check availability for all providers', async () => {
      mockOpenAIProvider.checkAvailability.mockResolvedValue(true);
      mockLlamaProvider.checkAvailability.mockResolvedValue(false);

      service.registerProvider(mockOpenAIProvider);
      service.registerProvider(mockLlamaProvider);

      const availability = await service.checkAllProvidersAvailability();

      expect(availability).toEqual({
        [LLMProviderType.OPENAI]: true,
        [LLMProviderType.LLAMA]: false,
      });
      expect(mockOpenAIProvider.checkAvailability).toHaveBeenCalled();
      expect(mockLlamaProvider.checkAvailability).toHaveBeenCalled();
    });

    it('should handle provider check errors', async () => {
      mockOpenAIProvider.checkAvailability.mockRejectedValue(new Error('Check failed'));

      service.registerProvider(mockOpenAIProvider);

      const availability = await service.checkAllProvidersAvailability();

      expect(availability[LLMProviderType.OPENAI]).toBe(false);
      expect(logService.warn).toHaveBeenCalledWith(
        `Ошибка проверки доступности провайдера ${LLMProviderType.OPENAI}`,
        expect.any(Object),
      );
    });
  });

  describe('getManagerInfo', () => {
    it('should return manager information', () => {
      service.registerProvider(mockOpenAIProvider);
      service.registerProvider(mockLlamaProvider);

      const info = service.getManagerInfo();

      expect(info).toEqual({
        activeProvider: LLMProviderType.OPENAI,
        registeredProviders: [LLMProviderType.OPENAI, LLMProviderType.LLAMA],
        providersInfo: [
          {
            type: LLMProviderType.OPENAI,
            name: 'OpenAI Test',
            models: ['gpt-4'],
            features: ['text_generation'],
          },
          {
            type: LLMProviderType.LLAMA,
            name: 'Llama Test',
            models: ['llama-4-70b'],
            features: ['text_generation'],
          },
        ],
      });
    });
  });

  describe('selectBestAvailableProvider', () => {
    it('should select best available provider based on priority', async () => {
      mockOpenAIProvider.checkAvailability.mockResolvedValue(true);
      mockLlamaProvider.checkAvailability.mockResolvedValue(true);

      service.registerProvider(mockOpenAIProvider);
      service.registerProvider(mockLlamaProvider);

      const selectedProvider = await service.selectBestAvailableProvider();

      expect(selectedProvider).toBe(LLMProviderType.OPENAI);
      expect(logService.log).toHaveBeenCalledWith(
        `Автоматически выбран лучший доступный провайдер: ${LLMProviderType.OPENAI}`,
      );
    });

    it('should select second priority provider when first is unavailable', async () => {
      mockOpenAIProvider.checkAvailability.mockResolvedValue(false);
      mockLlamaProvider.checkAvailability.mockResolvedValue(true);

      service.registerProvider(mockOpenAIProvider);
      service.registerProvider(mockLlamaProvider);

      const selectedProvider = await service.selectBestAvailableProvider();

      expect(selectedProvider).toBe(LLMProviderType.LLAMA);
    });

    it('should throw error when no providers are available', async () => {
      mockOpenAIProvider.checkAvailability.mockResolvedValue(false);
      mockLlamaProvider.checkAvailability.mockResolvedValue(false);

      service.registerProvider(mockOpenAIProvider);
      service.registerProvider(mockLlamaProvider);

      await expect(service.selectBestAvailableProvider()).rejects.toThrow(
        'Ни один LLM провайдер не доступен',
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty provider list gracefully', async () => {
      const availability = await service.checkAllProvidersAvailability();
      expect(availability).toEqual({});
    });

    it('should handle provider registration with same type', () => {
      const anotherOpenAIProvider = {
        ...mockOpenAIProvider,
        providerName: 'Another OpenAI',
      };

      service.registerProvider(mockOpenAIProvider);
      service.registerProvider(anotherOpenAIProvider);

      expect(logService.warn).toHaveBeenCalledWith(
        `Провайдер ${LLMProviderType.OPENAI} уже зарегистрирован, заменяю на новый`,
      );
    });
  });
});

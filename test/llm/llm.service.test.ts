import { createTest, createTestSuite, TestConfigType } from '../../lib/tester';
import { LLMService } from '../../src/llm/services/llm.service';
import {
  ILLMMessage,
  ILLMTextResult,
  ILLMJsonResult,
  LLMProviderType,
  LLMMessageRole,
} from '../../src/common/interfaces/llm-provider.interface';

// Мок провайдера LLM
const mockLLMProvider = {
  providerType: LLMProviderType.OPENAI,
  providerName: 'test-provider',
  generateText: jest.fn(),
  generateJSON: jest.fn(),
  generateTextStream: jest.fn(),
  estimateTokens: jest.fn(),
  checkAvailability: jest.fn(),
  getProviderInfo: jest.fn(),
};

// Мок LLMProviderManagerService
const mockProviderManager = {
  getActiveProvider: jest.fn(),
  setActiveProvider: jest.fn(),
  selectBestAvailableProvider: jest.fn(),
  getManagerInfo: jest.fn(),
  checkAllProvidersAvailability: jest.fn(),
};

// Мок LogService
const mockLogService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
};

createTestSuite('LLMService Tests', () => {
  let llmService: LLMService;
  let mockProviderManager: any;
  let mockLogService: any;
  let mockLLMProvider: any;

  beforeEach(() => {
    mockLLMProvider = {
      providerType: LLMProviderType.OPENAI,
      providerName: 'test-provider',
      generateText: jest.fn(),
      generateJSON: jest.fn(),
      generateTextStream: jest.fn(),
      estimateTokens: jest.fn(),
      checkAvailability: jest.fn(),
      getProviderInfo: jest.fn(),
    };

    mockProviderManager = {
      getActiveProvider: jest.fn().mockReturnValue(mockLLMProvider),
      setActiveProvider: jest.fn(),
      selectBestAvailableProvider: jest.fn(),
      getManagerInfo: jest.fn(),
      checkAllProvidersAvailability: jest.fn(),
    };

    mockLogService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      setContext: jest.fn().mockReturnThis(),
    };

    llmService = new LLMService(mockProviderManager, mockLogService);
    jest.clearAllMocks();
  });

  createTest(
    { name: 'должен создать экземпляр сервиса', configType: TestConfigType.DATABASE },
    async () => {
      expect(llmService).toBeDefined();
      expect(llmService).toBeInstanceOf(LLMService);
    },
  );

  createTest(
    { name: 'должен генерировать текст через провайдер', configType: TestConfigType.DATABASE },
    async () => {
      const mockMessages: ILLMMessage[] = [{ role: LLMMessageRole.USER, content: 'Привет!' }];
      const mockResult: ILLMTextResult = {
        text: 'Привет! Как дела?',
        requestInfo: {
          requestId: 'test-request',
          fromCache: false,
          executionTime: 100,
          promptTokens: 10,
          completionTokens: 15,
          totalTokens: 25,
          model: 'test-model',
        },
      };

      mockLLMProvider.generateText.mockResolvedValue(mockResult);

      const result = await llmService.generateText(mockMessages);

      expect(mockProviderManager.getActiveProvider).toHaveBeenCalled();
      expect(mockLLMProvider.generateText).toHaveBeenCalledWith(mockMessages, undefined);
      expect(result).toEqual(mockResult);
      expect(mockLogService.debug).toHaveBeenCalled();
    },
  );

  createTest(
    { name: 'должен генерировать JSON через провайдер', configType: TestConfigType.DATABASE },
    async () => {
      const mockMessages: ILLMMessage[] = [
        { role: LLMMessageRole.USER, content: 'Создай JSON объект' },
      ];
      const mockResult: ILLMJsonResult<{ test: string }> = {
        data: { test: 'value' },
        requestInfo: {
          requestId: 'test-request-json',
          fromCache: false,
          executionTime: 150,
          promptTokens: 15,
          completionTokens: 10,
          totalTokens: 25,
          model: 'test-model',
        },
      };

      mockLLMProvider.generateJSON.mockResolvedValue(mockResult);

      const result = await llmService.generateJSON(mockMessages);

      expect(mockProviderManager.getActiveProvider).toHaveBeenCalled();
      expect(mockLLMProvider.generateJSON).toHaveBeenCalledWith(mockMessages, undefined);
      expect(result).toEqual(mockResult);
      expect(result.data.test).toBe('value');
    },
  );

  createTest(
    { name: 'должен оценивать количество токенов', configType: TestConfigType.DATABASE },
    async () => {
      const testText = 'Это тестовый текст для подсчета токенов';
      const expectedTokens = 10;

      mockLLMProvider.estimateTokens.mockReturnValue(expectedTokens);

      const result = llmService.estimateTokens(testText);

      expect(mockProviderManager.getActiveProvider).toHaveBeenCalled();
      expect(mockLLMProvider.estimateTokens).toHaveBeenCalledWith(testText);
      expect(result).toBe(expectedTokens);
    },
  );

  createTest(
    { name: 'должен проверять доступность провайдера', configType: TestConfigType.DATABASE },
    async () => {
      mockLLMProvider.checkAvailability.mockResolvedValue(true);

      const result = await llmService.checkAvailability();

      expect(mockProviderManager.getActiveProvider).toHaveBeenCalled();
      expect(mockLLMProvider.checkAvailability).toHaveBeenCalled();
      expect(result).toBe(true);
    },
  );

  createTest(
    { name: 'должен переключать провайдер', configType: TestConfigType.DATABASE },
    async () => {
      const targetProvider = LLMProviderType.OPENAI; // Используем существующий тип

      mockLLMProvider.checkAvailability.mockResolvedValue(true);

      await llmService.switchProvider(targetProvider);

      expect(mockProviderManager.setActiveProvider).toHaveBeenCalledWith(targetProvider);
      // Проверяем, что логирование происходит через BaseService (logInfo вместо log)
      expect(mockLogService.log).toHaveBeenCalledWith(
        `Переключен на провайдер: ${targetProvider}`,
        undefined,
      );
    },
  );

  createTest(
    {
      name: 'должен возвращать информацию о активном провайдере',
      configType: TestConfigType.DATABASE,
    },
    async () => {
      const providerInfo = { name: 'test-provider', type: 'test' };

      mockLLMProvider.getProviderInfo.mockReturnValue(providerInfo);

      const result = llmService.getActiveProviderInfo();

      expect(mockProviderManager.getActiveProvider).toHaveBeenCalled();
      expect(mockLLMProvider.getProviderInfo).toHaveBeenCalled();
      expect(result).toEqual(providerInfo);
    },
  );

  createTest(
    { name: 'должен обрабатывать ошибки от провайдера', configType: TestConfigType.DATABASE },
    async () => {
      const mockMessages: ILLMMessage[] = [{ role: LLMMessageRole.USER, content: 'Тест' }];
      const testError = new Error('Provider error');
      mockLLMProvider.generateText.mockRejectedValue(testError);

      await expect(llmService.generateText(mockMessages)).rejects.toThrow('Provider error');
      expect(mockLogService.error).toHaveBeenCalled();
    },
  );
});

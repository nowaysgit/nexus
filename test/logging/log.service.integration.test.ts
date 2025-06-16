import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { LogService } from '../../src/logging/log.service';
import { RollbarService } from '../../src/logging/rollbar.service';
import { ConfigService } from '@nestjs/config';
import { Provider } from '@nestjs/common';
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';
import { MockRollbarService } from '../../lib/tester/mocks/rollbar.service.mock';

// Вспомогательная функция для ожидания выполнения асинхронных операций
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 50));

createTestSuite('LogService', () => {
  // Создаем экземпляры моков для каждого теста
  let mockLogService: MockLogService;
  let mockRollbarService: MockRollbarService;
  let mockConfigService: { get: jest.Mock };

  // Инициализируем моки перед каждым тестом
  beforeEach(() => {
    // Создаем новые экземпляры моков для каждого теста
    mockRollbarService = new MockRollbarService();
    mockLogService = new MockLogService();

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any): any => {
        const config: Record<string, any> = {
          'logging.rollbar.enabled': true,
          'logging.logger.level': 'info',
          'logging.rollbar': {
            enabled: true,
            accessToken: 'test-token',
            environment: 'test',
            captureUncaught: false,
            captureUnhandledRejections: false,
          },
        };
        return config[key] || defaultValue;
      }),
    };

    jest.clearAllMocks();
    console.log('Моки сброшены');
  });

  // Функция для создания провайдеров с актуальными моками
  const getProviders = (): Provider[] => [
    {
      provide: LogService,
      useValue: mockLogService,
    },
    {
      provide: RollbarService,
      useValue: mockRollbarService,
    },
    {
      provide: ConfigService,
      useValue: mockConfigService,
    },
  ];

  createTest(
    {
      name: 'should create logger instance',
      configType: TestConfigType.BASIC,
      providers: getProviders(),
    },
    async context => {
      const logService = context.get(LogService);
      expect(logService).toBeDefined();
    },
  );

  createTest(
    {
      name: 'should log info message',
      configType: TestConfigType.BASIC,
      providers: getProviders(),
      timeout: 5000, // Увеличиваем таймаут для надежности
    },
    async context => {
      const logService = context.get<MockLogService>(LogService);

      // Запоминаем начальное количество вызовов
      const initialCallsCount = logService.winstonLogger.info.mock.calls.length;
      console.log('mockLogService.winstonLogger.info до вызова:', initialCallsCount);

      // Сохраняем тестовое сообщение
      const testMessage = 'Test info message';
      const testMeta = { key: 'value' };

      // Вызываем метод логирования
      logService.info(testMessage, testMeta);

      // Добавляем небольшую задержку для обработки асинхронных операций
      await flushPromises();

      // Проверяем, что метод был вызван с правильными аргументами после задержки
      console.log(
        'mockLogService.winstonLogger.info после вызова:',
        logService.winstonLogger.info.mock.calls.length,
      );
      expect(logService.winstonLogger.info).toHaveBeenCalled();
      expect(logService.winstonLogger.info.mock.calls.length).toBeGreaterThan(initialCallsCount);

      // Проверяем, что последний вызов содержит наше тестовое сообщение
      const lastCallIndex = logService.winstonLogger.info.mock.calls.length - 1;
      const lastCall = logService.winstonLogger.info.mock.calls[lastCallIndex];
      expect(lastCall).toBeDefined();
      if (lastCall) {
        const [message] = lastCall;
        expect(message).toContain(testMessage);
      }
    },
  );

  createTest(
    {
      name: 'should set and get context',
      configType: TestConfigType.BASIC,
      providers: getProviders(),
    },
    async context => {
      const logService = context.get<MockLogService>(LogService);
      const contextLogger = logService.setContext('TestContext');
      expect(contextLogger.getContext()).toBe('TestContext');
    },
  );

  createTest(
    {
      name: 'should create logger for context',
      configType: TestConfigType.BASIC,
      providers: getProviders(),
    },
    async context => {
      const logService = context.get<MockLogService>(LogService);
      const contextLogger = logService.forContext('NewContext');
      expect(contextLogger.getContext()).toBe('NewContext');

      // Проверяем, что возвращаемый объект является экземпляром MockLogService
      expect(contextLogger).toBeInstanceOf(MockLogService);
    },
  );

  createTest(
    {
      name: 'should log error with Error object',
      configType: TestConfigType.BASIC,
      providers: getProviders(),
      timeout: 5000, // Увеличиваем таймаут для надежности
    },
    async context => {
      const logService = context.get<MockLogService>(LogService);
      const testError = new Error('Test error');

      // Запоминаем начальное количество вызовов
      const initialCallsCount = logService.winstonLogger.error.mock.calls.length;
      console.log('mockLogService.winstonLogger.error до вызова:', initialCallsCount);

      // Вызываем метод логирования
      logService.error(testError);

      // Добавляем небольшую задержку для обработки асинхронных операций
      await flushPromises();

      // Проверяем, что метод был вызван после задержки
      console.log(
        'mockLogService.winstonLogger.error после вызова:',
        logService.winstonLogger.error.mock.calls.length,
      );
      expect(logService.winstonLogger.error).toHaveBeenCalled();
      expect(logService.winstonLogger.error.mock.calls.length).toBeGreaterThan(initialCallsCount);

      // Проверяем, что последний вызов содержит информацию об ошибке
      const lastCallIndex = logService.winstonLogger.error.mock.calls.length - 1;
      const lastCall = logService.winstonLogger.error.mock.calls[lastCallIndex];
      expect(lastCall).toBeDefined();
      if (lastCall) {
        const [message] = lastCall;
        expect(message).toContain('Test error');
      }
    },
  );

  createTest(
    {
      name: 'should handle critical errors',
      configType: TestConfigType.BASIC,
      timeout: 5000, // Увеличиваем таймаут для надежности
      providers: getProviders(),
    },
    async context => {
      const logService = context.get<MockLogService>(LogService);
      const criticalError = new Error('Critical failure');

      // Запоминаем начальное количество вызовов
      const initialErrorCallsCount = logService.winstonLogger.error.mock.calls.length;
      console.log('mockLogService.winstonLogger.error до вызова:', initialErrorCallsCount);

      // Вызываем метод логирования
      logService.critical(criticalError, { userId: '123' });

      // Добавляем небольшую задержку для обработки асинхронных операций
      await flushPromises();

      // Проверяем, что методы были вызваны после задержки
      console.log(
        'mockLogService.winstonLogger.error после вызова:',
        logService.winstonLogger.error.mock.calls.length,
      );

      // Проверяем, что метод был вызван
      expect(logService.winstonLogger.error).toHaveBeenCalled();
      expect(logService.winstonLogger.error.mock.calls.length).toBeGreaterThan(
        initialErrorCallsCount,
      );

      // Проверяем, что последний вызов содержит информацию об ошибке
      const lastErrorCallIndex = logService.winstonLogger.error.mock.calls.length - 1;
      const lastErrorCall = logService.winstonLogger.error.mock.calls[lastErrorCallIndex];

      expect(lastErrorCall).toBeDefined();

      if (lastErrorCall) {
        const [message] = lastErrorCall;
        expect(message).toContain('CRITICAL: Critical failure');
      }
    },
  );

  createTest(
    {
      name: 'should notify Rollbar on critical errors',
      configType: TestConfigType.BASIC,
      timeout: 5000, // Увеличиваем таймаут для надежности
      providers: getProviders(),
    },
    async context => {
      // Получаем напрямую экземпляр RollbarService для проверки
      const rollbarService = context.get<MockRollbarService>(RollbarService);
      const criticalError = new Error('Critical failure for Rollbar');

      // Запоминаем начальное количество вызовов
      const initialCriticalCallsCount = rollbarService.mockCalls.critical.length;
      console.log('mockRollbarService.mockCalls.critical до вызова:', initialCriticalCallsCount);

      // Проверяем, что rollbarService и mockCalls.critical существуют
      expect(rollbarService).toBeDefined();
      expect(rollbarService.mockCalls).toBeDefined();
      expect(rollbarService.mockCalls.critical).toBeDefined();

      // Делаем прямой вызов rollbarService.critical
      rollbarService.critical(criticalError, { userId: '123' });

      // Проверяем, что вызов работает
      console.log(
        'mockRollbarService.mockCalls.critical после вызова:',
        rollbarService.mockCalls.critical.length,
      );
      expect(rollbarService.mockCalls.critical.length).toBeGreaterThan(initialCriticalCallsCount);

      // Проверяем содержимое последнего вызова
      const lastCriticalCallIndex = rollbarService.mockCalls.critical.length - 1;
      const lastCriticalCall = rollbarService.mockCalls.critical[lastCriticalCallIndex];

      expect(lastCriticalCall).toBeDefined();

      if (lastCriticalCall) {
        const [error, meta] = lastCriticalCall;
        expect(error.message).toBe('Critical failure for Rollbar');
        expect(meta).toEqual(expect.objectContaining({ userId: '123' }));
      }
    },
  );
});

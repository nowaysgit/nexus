import { createTest, createTestSuite, TestConfigType } from '../../../lib/tester';
import { BaseService } from '../../../src/common/base/base.service';
import { LogService } from '../../../src/logging/log.service';
import { MockLogService } from '../../../lib/tester/mocks';

// Тестовый класс, наследующий BaseService
class TestService extends BaseService {
  constructor(logService: LogService) {
    super(logService);
  }

  async testAsyncMethod(): Promise<string> {
    return this.withErrorHandling('testAsyncMethod', async () => {
      return 'success';
    });
  }

  async testAsyncMethodWithError(): Promise<string> {
    return this.withErrorHandling('testAsyncMethodWithError', async () => {
      throw new Error('Test error');
    });
  }

  testSyncMethod(): string {
    return this.withErrorHandlingSync('testSyncMethod', () => {
      return 'success';
    });
  }

  testSyncMethodWithError(): string {
    return this.withErrorHandlingSync('testSyncMethodWithError', () => {
      throw new Error('Test error');
    });
  }

  testLogMethods(): void {
    this.logInfo('Test info message');
    this.logWarning('Test warning message');
    this.logError('Test error message');
    this.logDebug('Test debug message');
  }
}

createTestSuite('BaseService Tests', () => {
  createTest(
    {
      name: 'должен корректно инициализировать логгер с контекстом',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: LogService,
          useClass: MockLogService,
        },
      ],
    },
    async context => {
      const logService = context.get(LogService);
      const setContextSpy = jest.spyOn(logService, 'setContext');

      const testService = new TestService(logService as unknown as LogService);

      expect(setContextSpy).toHaveBeenCalledWith('TestService');
      expect(testService['logService']).toBeDefined();
    },
  );

  createTest(
    {
      name: 'должен успешно выполнять асинхронные операции с обработкой ошибок',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: LogService,
          useClass: MockLogService,
        },
      ],
    },
    async context => {
      const logService = context.get(LogService);
      const debugSpy = jest.spyOn(logService, 'debug');

      const testService = new TestService(logService as unknown as LogService);
      const result = await testService.testAsyncMethod();

      expect(result).toBe('success');
      expect(debugSpy).toHaveBeenCalledWith('Начало выполнения операции: testAsyncMethod');
      expect(debugSpy).toHaveBeenCalledWith('Операция завершена успешно: testAsyncMethod');
    },
  );

  createTest(
    {
      name: 'должен корректно обрабатывать ошибки в асинхронных операциях',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: LogService,
          useClass: MockLogService,
        },
      ],
    },
    async context => {
      const logService = context.get(LogService);
      const errorSpy = jest.spyOn(logService, 'error');

      const testService = new TestService(logService as unknown as LogService);

      await expect(testService.testAsyncMethodWithError()).rejects.toThrow('Test error');
      expect(errorSpy).toHaveBeenCalledWith(
        'Ошибка при выполнении операции "testAsyncMethodWithError"',
        expect.objectContaining({
          operation: 'testAsyncMethodWithError',
          error: 'Test error',
          stack: expect.any(String) as string,
        }),
      );
    },
  );

  createTest(
    {
      name: 'должен успешно выполнять синхронные операции с обработкой ошибок',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: LogService,
          useClass: MockLogService,
        },
      ],
    },
    async context => {
      const logService = context.get(LogService);
      const debugSpy = jest.spyOn(logService, 'debug');

      const testService = new TestService(logService as unknown as LogService);
      const result = testService.testSyncMethod();

      expect(result).toBe('success');
      expect(debugSpy).toHaveBeenCalledWith('Начало выполнения операции: testSyncMethod');
      expect(debugSpy).toHaveBeenCalledWith('Операция завершена успешно: testSyncMethod');
    },
  );

  createTest(
    {
      name: 'должен корректно обрабатывать ошибки в синхронных операциях',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: LogService,
          useClass: MockLogService,
        },
      ],
    },
    async context => {
      const logService = context.get(LogService);
      const errorSpy = jest.spyOn(logService, 'error');

      const testService = new TestService(logService as unknown as LogService);

      expect(() => testService.testSyncMethodWithError()).toThrow('Test error');
      expect(errorSpy).toHaveBeenCalledWith(
        'Ошибка при выполнении операции "testSyncMethodWithError"',
        expect.objectContaining({
          operation: 'testSyncMethodWithError',
          error: 'Test error',
          stack: expect.any(String) as string,
        }),
      );
    },
  );

  createTest(
    {
      name: 'должен предоставлять методы для логирования',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: LogService,
          useClass: MockLogService,
        },
      ],
    },
    async context => {
      const logService = context.get(LogService);
      const infoSpy = jest.spyOn(logService, 'info');
      const warnSpy = jest.spyOn(logService, 'warn');
      const errorSpy = jest.spyOn(logService, 'error');
      const debugSpy = jest.spyOn(logService, 'debug');

      const testService = new TestService(logService as unknown as LogService);
      testService.testLogMethods();

      expect(infoSpy).toHaveBeenCalledWith('Test info message', undefined);
      expect(warnSpy).toHaveBeenCalledWith('Test warning message', undefined);
      expect(errorSpy).toHaveBeenCalledWith('Test error message', undefined);
      expect(debugSpy).toHaveBeenCalledWith('Test debug message', undefined);
    },
  );

  createTest(
    {
      name: 'должен обрабатывать случай, когда logService не имеет метод setContext',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [],
    },
    async () => {
      const mockLogService = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as unknown as LogService;

      const testService = new TestService(mockLogService);

      expect(testService['logService']).toBe(mockLogService);
    },
  );
});

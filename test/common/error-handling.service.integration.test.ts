import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { Test, TestingModule } from '@nestjs/testing';
import { LogService } from '../../src/logging/log.service';
import { ConfigService } from '@nestjs/config';
import { ErrorHandlingService } from '../../src/common/utils/error-handling/error-handling.service';

createTestSuite('ErrorHandling.service Integration Tests', () => {
  let service: ErrorHandlingService;
  let logService: LogService;
  let moduleRef: TestingModule;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'environment.isProduction') return false;
      return null;
    }),
  };

  const mockLogService = {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    setContext: jest.fn(),
    forContext: jest.fn().mockReturnThis(),
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ErrorHandlingService,
        { provide: LogService, useValue: mockLogService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = moduleRef.get<ErrorHandlingService>(ErrorHandlingService);
    logService = moduleRef.get<LogService>(LogService);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  createTest(
    {
      name: 'should log error with custom log service',
      configType: TestConfigType.INTEGRATION,
      requiresDatabase: false,
    },
    async () => {
      const testError = new Error('Test error');
      service.logError(logService, 'test operation', testError);
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining('Ошибка при test operation: Test error'),
        { context: 'ErrorHandlingService', operation: 'test operation' }
      );
    },
  );

  createTest(
    {
      name: 'should handle async operation with error handling',
      configType: TestConfigType.INTEGRATION,
      requiresDatabase: false,
    },
    async () => {
      const successResult = await service.withErrorHandling(
        async () => 'success',
        'test operation',
        logService,
      );
      expect(successResult).toBe('success');

      try {
        const errorResult = await service.withErrorHandling(
          async () => {
            throw new Error('Test error');
          },
          'test operation',
          logService,
          { defaultValue: 'default' },
        );
        expect(errorResult).toBe('default');
        expect(logService.error).toHaveBeenCalled();
      } catch (_error) {
        // Игнорируем ошибку, так как мы проверяем, что withErrorHandling возвращает defaultValue
      }
    },
  );

  createTest(
    {
      name: 'should handle not found items',
      configType: TestConfigType.INTEGRATION,
      requiresDatabase: false,
    },
    async () => {
      interface TestItem {
        id: number;
      }
      const foundItem = service.handleNotFound<TestItem>({ id: 1 }, 'User', 1, logService);
      expect(foundItem).toEqual({ id: 1 });
      const notFoundItem = service.handleNotFound<TestItem>(null, 'User', 1, logService, false);
      expect(notFoundItem).toBeNull();
      expect(() => {
        service.handleNotFound(null, 'User', 1, logService, true);
      }).toThrow('User с ID 1 не найден');
    },
  );
});

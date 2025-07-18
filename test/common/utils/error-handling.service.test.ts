import { Test, TestingModule } from '@nestjs/testing';
import {
  Logger,
  HttpStatus,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ErrorHandlingService,
  SafeOperationResult,
} from '../../../src/common/utils/error-handling/error-handling.service';
import { LogService } from '../../../src/logging/log.service';
import { MockLogService } from '../../../lib/tester/mocks/log.service.mock';

describe('ErrorHandlingService', () => {
  let service: ErrorHandlingService;
  let mockLogService: MockLogService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(async () => {
    mockLogService = new MockLogService();
    mockConfigService = {
      get: jest.fn(),
    } as any;
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErrorHandlingService,
        { provide: LogService, useValue: mockLogService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ErrorHandlingService>(ErrorHandlingService);
  });

  describe('инициализация', () => {
    it('должен инициализироваться с конфигурацией по умолчанию', () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module = Test.createTestingModule({
        providers: [
          ErrorHandlingService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      expect(module).toBeDefined();
    });

    it('должен использовать конфигурацию из ConfigService', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'environment') {
          return { isProduction: true };
        }
        if (key === 'database') {
          return { allowUnsafe: true };
        }
        return undefined;
      });

      const module = Test.createTestingModule({
        providers: [
          ErrorHandlingService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      expect(module).toBeDefined();
    });
  });

  describe('logError', () => {
    it('должен логировать ошибку с LogService', () => {
      const error = new Error('Test error');
      const operation = 'test operation';
      const meta = { key: 'value' };

      service.logError(mockLogService as any, operation, error, meta);

      expect(mockLogService.winstonLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Ошибка при ${operation}: ${error.message}`),
        expect.any(Object),
      );
    });

    it('должен логировать ошибку с обычным Logger', () => {
      const error = new Error('Test error');
      const operation = 'test operation';

      service.logError(mockLogger, operation, error);

      expect(mockLogger.error).toHaveBeenCalledWith(`Ошибка при ${operation}: ${error.message}`);
    });

    it('должен обрабатывать строковые ошибки', () => {
      const error = 'String error';
      const operation = 'test operation';

      service.logError(mockLogService as any, operation, error);

      expect(mockLogService.winstonLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Ошибка при ${operation}: ${error}`),
        expect.any(Object),
      );
    });

    it('должен обрабатывать объектные ошибки', () => {
      const error = { message: 'Object error', code: 500 };
      const operation = 'test operation';

      service.logError(mockLogService as any, operation, error);

      expect(mockLogService.winstonLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Ошибка при test operation:'),
        expect.any(Object),
      );
    });
  });

  describe('withErrorHandling', () => {
    it('должен выполнить операцию успешно', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await service.withErrorHandling(
        operation,
        'test operation',
        mockLogService as any,
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('должен обработать ошибку и вернуть значение по умолчанию', async () => {
      const error = new Error('Test error');
      const operation = jest.fn().mockRejectedValue(error);
      const defaultValue = 'default';

      const result = await service.withErrorHandling(
        operation,
        'test operation',
        mockLogService as any,
        {},
        defaultValue,
      );

      expect(result).toBe(defaultValue);
      expect(mockLogService.winstonLogger.error).toHaveBeenCalled();
    });

    it('должен пробросить ошибку если нет значения по умолчанию', async () => {
      const error = new Error('Test error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        service.withErrorHandling(operation, 'test operation', mockLogService as any),
      ).rejects.toThrow('Test error');
    });
  });

  describe('handleNotFound', () => {
    it('должен вернуть элемент если он существует', () => {
      const item = { id: 1, name: 'Test' };
      const result = service.handleNotFound(item, 'TestEntity', 1, mockLogService as any);

      expect(result).toBe(item);
    });

    it('должен выбросить ошибку если элемент не найден', () => {
      expect(() => {
        service.handleNotFound(null, 'TestEntity', 1, mockLogService as any);
      }).toThrow('TestEntity с ID 1 не найден');

      expect(mockLogService.winstonLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('TestEntity с ID 1 не найден'),
        expect.objectContaining({
          context: 'ErrorHandlingService',
          timestamp: expect.any(String),
        }),
      );
    });

    it('должен вернуть null если throwError = false', () => {
      const result = service.handleNotFound(null, 'TestEntity', 1, mockLogService as any, false);

      expect(result).toBeNull();
    });

    it('должен работать с обычным Logger', () => {
      expect(() => {
        service.handleNotFound(null, 'TestEntity', 1, mockLogger);
      }).toThrow('TestEntity с ID 1 не найден');

      expect(mockLogger.error).toHaveBeenCalledWith('TestEntity с ID 1 не найден');
    });
  });

  describe('requireService', () => {
    it('должен вернуть сервис если он доступен', () => {
      const service_obj = { test: 'value' };
      const result = service.requireService(service_obj, 'TestService', mockLogService as any);

      expect(result).toBe(service_obj);
    });

    it('должен вернуть null и залогировать предупреждение если сервис недоступен', () => {
      const result = service.requireService(null, 'TestService', mockLogService as any);

      expect(result).toBeNull();
      expect(mockLogService.winstonLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Сервис TestService не доступен'),
        expect.any(Object),
      );
    });

    it('должен работать с обычным Logger', () => {
      const result = service.requireService(undefined, 'TestService', mockLogger);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Сервис TestService не доступен');
    });
  });

  describe('measureExecutionTime', () => {
    it('должен измерить время выполнения операции', async () => {
      const operation = jest.fn().mockResolvedValue('result');
      const result = await service.measureExecutionTime(
        operation,
        'test operation',
        mockLogService as any,
      );

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalled();

      // Проверяем, что log был вызван с правильным сообщением
      expect(mockLogService.winstonLogger.log).toHaveBeenCalled();
      const [message, meta] = mockLogService.winstonLogger.log.mock.calls[0];
      expect(message).toEqual(expect.stringContaining('Операция test operation выполнена за'));

      // Если передаются метаданные, проверяем их структуру
      if (meta) {
        expect(meta).toEqual(
          expect.objectContaining({
            operationName: 'test operation',
            executionTime: expect.any(Number),
          }),
        );
      }
    });

    it('должен обработать ошибку при выполнении операции', async () => {
      const error = new Error('Test error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        service.measureExecutionTime(operation, 'test operation', mockLogService as any),
      ).rejects.toThrow('Test error');

      expect(mockLogService.winstonLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Операция test operation завершилась ошибкой за'),
        expect.objectContaining({
          context: 'ErrorHandlingService',
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe('formatError', () => {
    it('должен форматировать Error объект', () => {
      const error = new Error('Test error');
      error.stack = 'Stack trace';
      const result = service.formatError(error);

      expect(result).toEqual({
        message: 'Test error',
        stack: 'Stack trace',
        name: 'Error',
      });
    });

    it('должен форматировать строковую ошибку', () => {
      const error = 'String error';
      const result = service.formatError(error);

      expect(result).toEqual({
        message: 'String error',
      });
    });

    it('должен форматировать объектную ошибку', () => {
      const error = { message: 'Object error', code: 500 };
      const result = service.formatError(error);

      expect(result).toEqual({
        message: 'Object error',
        code: 500,
      });
    });

    it('должен форматировать неизвестную ошибку', () => {
      const error = 123;
      const result = service.formatError(error);

      expect(result).toEqual({
        message: '123',
      });
    });
  });

  describe('toHttpException', () => {
    it('должен преобразовать Error в HttpException', () => {
      const error = new Error('Test error');
      const result = service.toHttpException(error);

      expect(result).toBeInstanceOf(HttpException);
      expect(result.message).toBe('Test error');
    });

    it('должен использовать значения по умолчанию', () => {
      const error = 'String error';
      const result = service.toHttpException(error, 'Default message', HttpStatus.BAD_REQUEST);

      expect(result).toBeInstanceOf(HttpException);
      expect(result.message).toBe('Default message');
    });

    it('должен обработать HttpException', () => {
      const error = new BadRequestException('Bad request');
      const result = service.toHttpException(error);

      expect(result).toBe(error);
    });
  });

  describe('checkOperation', () => {
    it('должен разрешить безопасную операцию', () => {
      const result = service.checkOperation('safeOperation');

      expect(result).toEqual({
        allowed: true,
      });
    });

    it('должен запретить небезопасную операцию', () => {
      const result = service.checkOperation('dropSchema');

      expect(result).toEqual({
        allowed: false,
        reason: 'Операция dropSchema находится в списке запрещенных',
      });
    });

    it('должен требовать подтверждение для операции', () => {
      const result = service.checkOperation('clearDatabase');

      expect(result).toEqual({
        allowed: false,
        reason: 'Операция clearDatabase требует подтверждения',
        requireConfirmation: true,
      });
    });
  });

  describe('executeOperation', () => {
    it('должен выполнить разрешенную операцию', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await service.executeOperation('safeOperation', operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('должен отклонить запрещенную операцию', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await service.executeOperation('dropSchema', operation);

      expect(result).toBeNull();
      expect(operation).not.toHaveBeenCalled();
    });

    it('должен выполнить операцию с подтверждением', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await service.executeOperation('clearDatabase', operation, true);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('должен отклонить операцию без подтверждения', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await service.executeOperation('clearDatabase', operation, false);

      expect(result).toBeNull();
      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('type guards', () => {
    it('hasProp должен проверить наличие свойства', () => {
      const obj = { test: 'value' };
      expect(service.hasProp(obj, 'test')).toBe(true);
      expect(service.hasProp(obj, 'missing')).toBe(false);
      expect(service.hasProp(null, 'test')).toBe(false);
    });

    it('isString должен проверить строку', () => {
      expect(service.isString('test')).toBe(true);
      expect(service.isString(123)).toBe(false);
      expect(service.isString(null)).toBe(false);
    });

    it('isNumber должен проверить число', () => {
      expect(service.isNumber(123)).toBe(true);
      expect(service.isNumber('123')).toBe(false);
      expect(service.isNumber(null)).toBe(false);
    });

    it('isBoolean должен проверить булево значение', () => {
      expect(service.isBoolean(true)).toBe(true);
      expect(service.isBoolean(false)).toBe(true);
      expect(service.isBoolean('true')).toBe(false);
      expect(service.isBoolean(1)).toBe(false);
    });

    it('isObject должен проверить объект', () => {
      expect(service.isObject({})).toBe(true);
      expect(service.isObject({ test: 'value' })).toBe(true);
      expect(service.isObject(null)).toBe(false);
      expect(service.isObject([])).toBe(false);
      expect(service.isObject('test')).toBe(false);
    });

    it('isArray должен проверить массив', () => {
      expect(service.isArray([])).toBe(true);
      expect(service.isArray([1, 2, 3])).toBe(true);
      expect(service.isArray({})).toBe(false);
      expect(service.isArray('test')).toBe(false);
    });

    it('isArray должен проверить массив с предикатом', () => {
      const isString = (item: unknown): item is string => typeof item === 'string';
      expect(service.isArray(['a', 'b', 'c'], isString)).toBe(true);
      expect(service.isArray([1, 2, 3], isString)).toBe(false);
    });
  });

  describe('статические методы', () => {
    it('withErrorHandling должен работать статически', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await ErrorHandlingService.withErrorHandling(
        operation,
        'test operation',
        mockLogService as any,
      );

      expect(result).toBe('success');
    });

    it('logError должен работать статически', () => {
      const error = new Error('Test error');
      ErrorHandlingService.logError(mockLogService as any, 'test operation', error);

      expect(mockLogService.winstonLogger.error).toHaveBeenCalled();
    });

    it('measureExecutionTime должен работать статически', async () => {
      const operation = jest.fn().mockResolvedValue('result');
      const result = await ErrorHandlingService.measureExecutionTime(
        operation,
        'test operation',
        mockLogService as any,
      );

      expect(result).toBe('result');
    });
  });
});

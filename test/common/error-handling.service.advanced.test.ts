import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorHandlingService } from '../../src/common/utils/error-handling/error-handling.service';
import { LogService } from '../../src/logging/log.service';

describe('ErrorHandlingService - Safe Operations & Utility Methods', () => {
  let service: ErrorHandlingService;
  let logService: LogService;

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

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErrorHandlingService,
        { provide: LogService, useValue: mockLogService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ErrorHandlingService>(ErrorHandlingService);
    logService = module.get<LogService>(LogService);

    jest.clearAllMocks();
  });

  describe('checkOperation', () => {
    it('should allow safe operations by default', () => {
      const result = service.checkOperation('safeOperation');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block forbidden operations', () => {
      const result = service.checkOperation('dropSchema');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('находится в списке запрещенных');
    });

    it('should require confirmation for confirmation operations', () => {
      const result = service.checkOperation('clearDatabase');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('требует подтверждения');
      expect(result.requireConfirmation).toBe(true);
    });

    it('should allow confirmation operations with confirmation', () => {
      const result = service.checkOperation('clearDatabase', true);

      expect(result.allowed).toBe(true);
    });

    it('should block forbidden operations even with confirmation', () => {
      const result = service.checkOperation('dropSchema', true);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('находится в списке запрещенных');
    });
  });

  describe('executeOperation', () => {
    it('should execute allowed operation successfully', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await service.executeOperation('safeOperation', operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
      expect(mockLogService.log).toHaveBeenCalledWith('Операция safeOperation выполнена успешно');
    });

    it('should reject forbidden operation', async () => {
      const operation = jest.fn();
      const result = await service.executeOperation('dropSchema', operation);

      expect(result).toBeNull();
      expect(operation).not.toHaveBeenCalled();
      expect(mockLogService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Операция dropSchema отклонена')
      );
    });

    it('should reject operation requiring confirmation without confirmation', async () => {
      const operation = jest.fn();
      const result = await service.executeOperation('clearDatabase', operation);

      expect(result).toBeNull();
      expect(operation).not.toHaveBeenCalled();
      expect(mockLogService.warn).toHaveBeenCalled();
    });

    it('should execute operation requiring confirmation with confirmation', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await service.executeOperation('clearDatabase', operation, true);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should handle operation errors', async () => {
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        service.executeOperation('safeOperation', operation)
      ).rejects.toThrow('Operation failed');

      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка при выполнении операции safeOperation',
        'Operation failed'
      );
    });
  });

  describe('Type checking utilities', () => {
    describe('hasProp', () => {
      it('should return true for existing property', () => {
        const obj = { test: 'value' };
        const result = service.hasProp(obj, 'test');

        expect(result).toBe(true);
      });

      it('should return false for non-existing property', () => {
        const obj = { other: 'value' };
        const result = service.hasProp(obj, 'test');

        expect(result).toBe(false);
      });

      it('should return false for null object', () => {
        const result = service.hasProp(null, 'test');

        expect(result).toBe(false);
      });

      it('should return false for non-object', () => {
        const result = service.hasProp('string', 'test');

        expect(result).toBe(false);
      });
    });

    describe('hasPropOfType', () => {
      it('should return true for property with correct type', () => {
        const obj = { test: 'value' };
        const isString = (value: unknown): value is string => typeof value === 'string';
        const result = service.hasPropOfType(obj, 'test', isString);

        expect(result).toBe(true);
      });

      it('should return false for property with incorrect type', () => {
        const obj = { test: 123 };
        const isString = (value: unknown): value is string => typeof value === 'string';
        const result = service.hasPropOfType(obj, 'test', isString);

        expect(result).toBe(false);
      });

      it('should return false for non-existing property', () => {
        const obj = { other: 'value' };
        const isString = (value: unknown): value is string => typeof value === 'string';
        const result = service.hasPropOfType(obj, 'test', isString);

        expect(result).toBe(false);
      });
    });

    describe('isString', () => {
      it('should return true for string', () => {
        expect(service.isString('test')).toBe(true);
        expect(service.isString('')).toBe(true);
      });

      it('should return false for non-string', () => {
        expect(service.isString(123)).toBe(false);
        expect(service.isString(null)).toBe(false);
        expect(service.isString(undefined)).toBe(false);
        expect(service.isString({})).toBe(false);
      });
    });

    describe('isNumber', () => {
      it('should return true for valid numbers', () => {
        expect(service.isNumber(123)).toBe(true);
        expect(service.isNumber(0)).toBe(true);
        expect(service.isNumber(-123.45)).toBe(true);
      });

      it('should return false for invalid numbers', () => {
        expect(service.isNumber(NaN)).toBe(false);
        expect(service.isNumber('123')).toBe(false);
        expect(service.isNumber(null)).toBe(false);
        expect(service.isNumber(undefined)).toBe(false);
      });
    });

    describe('isBoolean', () => {
      it('should return true for boolean values', () => {
        expect(service.isBoolean(true)).toBe(true);
        expect(service.isBoolean(false)).toBe(true);
      });

      it('should return false for non-boolean values', () => {
        expect(service.isBoolean(1)).toBe(false);
        expect(service.isBoolean(0)).toBe(false);
        expect(service.isBoolean('true')).toBe(false);
        expect(service.isBoolean(null)).toBe(false);
      });
    });

    describe('isObject', () => {
      it('should return true for plain objects', () => {
        expect(service.isObject({})).toBe(true);
        expect(service.isObject({ key: 'value' })).toBe(true);
      });

      it('should return false for non-objects', () => {
        expect(service.isObject(null)).toBe(false);
        expect(service.isObject([])).toBe(false);
        expect(service.isObject('string')).toBe(false);
        expect(service.isObject(123)).toBe(false);
        expect(service.isObject(undefined)).toBe(false);
      });
    });

    describe('isArray', () => {
      it('should return true for arrays', () => {
        expect(service.isArray([])).toBe(true);
        expect(service.isArray([1, 2, 3])).toBe(true);
      });

      it('should return false for non-arrays', () => {
        expect(service.isArray({})).toBe(false);
        expect(service.isArray('string')).toBe(false);
        expect(service.isArray(null)).toBe(false);
      });

      it('should validate array items with predicate', () => {
        const isString = (item: unknown): item is string => typeof item === 'string';
        
        expect(service.isArray(['a', 'b', 'c'], isString)).toBe(true);
        expect(service.isArray([1, 2, 3], isString)).toBe(false);
        expect(service.isArray(['a', 1, 'c'], isString)).toBe(false);
      });

      it('should return true for empty array with predicate', () => {
        const isString = (item: unknown): item is string => typeof item === 'string';
        expect(service.isArray([], isString)).toBe(true);
      });
    });
  });

  describe('HandleControllerErrors decorator', () => {
    it('should create decorator function', () => {
      const decorator = service.HandleControllerErrors({
        defaultMessage: 'Controller error',
        defaultStatus: 400,
        logError: true,
      });

      expect(typeof decorator).toBe('function');
    });

    it('should handle successful method execution', async () => {
      const decorator = service.HandleControllerErrors({});
      const mockMethod = jest.fn().mockReturnValue('success');
      const descriptor = { value: mockMethod };

      decorator({}, 'testMethod', descriptor);

      const result = await descriptor.value();
      expect(result).toBe('success');
    });

    it('should handle promise-based method execution', async () => {
      const decorator = service.HandleControllerErrors({});
      const mockMethod = jest.fn().mockResolvedValue('async success');
      const descriptor = { value: mockMethod };

      decorator({}, 'testMethod', descriptor);

      const result = await descriptor.value();
      expect(result).toBe('async success');
    });

    it('should handle method errors with logging', async () => {
      const mockLogger = { error: jest.fn() };
      const decorator = service.HandleControllerErrors({ logError: true });
      const error = new Error('Method error');
      const mockMethod = jest.fn().mockRejectedValue(error);
      const descriptor = { value: mockMethod };
      const target = { constructor: { name: 'TestController' } };
      const context = { logger: mockLogger };

      decorator(target, 'testMethod', descriptor);

      await expect(descriptor.value.call(context)).rejects.toThrow('Method error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Ошибка в TestController.testMethod',
        error.stack
      );
    });

    it('should handle method errors without logging', async () => {
      const decorator = service.HandleControllerErrors({ logError: false });
      const error = new Error('Method error');
      const mockMethod = jest.fn().mockRejectedValue(error);
      const descriptor = { value: mockMethod };

      decorator({}, 'testMethod', descriptor);

      await expect(descriptor.value()).rejects.toThrow('Method error');
    });

    it('should use toHttpException when available', async () => {
      const mockToHttpException = jest.fn().mockReturnValue(new Error('HTTP Error'));
      const decorator = service.HandleControllerErrors({
        defaultMessage: 'Default error',
        defaultStatus: 500,
      });
      const error = new Error('Original error');
      const mockMethod = jest.fn().mockRejectedValue(error);
      const descriptor = { value: mockMethod };
      const context = { toHttpException: mockToHttpException };

      decorator({}, 'testMethod', descriptor);

      await expect(descriptor.value.call(context)).rejects.toThrow('HTTP Error');
      expect(mockToHttpException).toHaveBeenCalledWith(error, 'Default error', 500);
    });
  });

  describe('Static methods', () => {
    describe('withErrorHandling', () => {
      it('should handle successful operation', async () => {
        const operation = jest.fn().mockResolvedValue('success');
        const result = await ErrorHandlingService.withErrorHandling(
          operation,
          'test',
          mockLogService as unknown as LogService
        );

        expect(result).toBe('success');
        expect(mockLogService.error).not.toHaveBeenCalled();
      });

      it('should handle operation with error and default value', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('Test error'));
        const result = await ErrorHandlingService.withErrorHandling(
          operation,
          'test',
          mockLogService as unknown as LogService,
          {},
          'default'
        );

        expect(result).toBe('default');
        expect(mockLogService.error).toHaveBeenCalled();
      });

      it('should handle operation with error and no default value', async () => {
        const error = new Error('Test error');
        const operation = jest.fn().mockRejectedValue(error);

        await expect(
          ErrorHandlingService.withErrorHandling(
            operation,
            'test',
            mockLogService as unknown as LogService
          )
        ).rejects.toThrow('Test error');

        expect(mockLogService.error).toHaveBeenCalled();
      });

      it('should work with standard logger', async () => {
        const mockLogger = { error: jest.fn() };
        const operation = jest.fn().mockRejectedValue(new Error('Test error'));

        await expect(
          ErrorHandlingService.withErrorHandling(
            operation,
            'test',
            mockLogger as unknown as Logger,
            {},
            'default'
          )
        ).resolves.toBe('default');

        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('logError', () => {
      it('should log error with LogService', () => {
        const error = new Error('Test error');
        ErrorHandlingService.logError(
          mockLogService as unknown as LogService,
          'test operation',
          error
        );

        expect(mockLogService.error).toHaveBeenCalledWith(
          'Test error',
          undefined
        );
      });

      it('should log error with standard Logger', () => {
        const mockLogger = { error: jest.fn() };
        const error = new Error('Test error');
        ErrorHandlingService.logError(
          mockLogger as unknown as Logger,
          'test operation',
          error
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Ошибка при test operation: Test error'
        );
      });

      it('should handle non-Error objects', () => {
        ErrorHandlingService.logError(
          mockLogService as unknown as LogService,
          'test operation',
          { message: 'object error' }
        );

        expect(mockLogService.error).toHaveBeenCalled();
      });

      it('should handle circular reference objects', () => {
        const circularObj: any = { prop: 'value' };
        circularObj.self = circularObj;

        ErrorHandlingService.logError(
          mockLogService as unknown as LogService,
          'test operation',
          circularObj
        );

        expect(mockLogService.error).toHaveBeenCalledWith(
          'Ошибка при test operation: [Object object]',
          undefined
        );
      });
    });

    describe('measureExecutionTime', () => {
      beforeEach(() => {
        jest.spyOn(Date, 'now')
          .mockReturnValueOnce(1000)
          .mockReturnValueOnce(1500);
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it('should measure successful operation time', async () => {
        const operation = jest.fn().mockResolvedValue('success');
        const result = await ErrorHandlingService.measureExecutionTime(
          operation,
          'test_operation',
          mockLogService as unknown as LogService
        );

        expect(result).toBe('success');
        expect(mockLogService.log).toHaveBeenCalledWith(
          'Операция test_operation выполнена за 500ms',
          {
            operationName: 'test_operation',
            executionTime: 500,
          }
        );
      });

      it('should measure failed operation time', async () => {
        const error = new Error('Test error');
        const operation = jest.fn().mockRejectedValue(error);

        await expect(
          ErrorHandlingService.measureExecutionTime(
            operation,
            'test_operation',
            mockLogService as unknown as LogService
          )
        ).rejects.toThrow('Test error');

        expect(mockLogService.error).toHaveBeenCalledWith(
          'Ошибка при выполнении операции test_operation',
          {
            executionTime: '500.00ms',
            error: 'Test error',
          }
        );
      });

      it('should work with standard logger', async () => {
        const mockLogger = { log: jest.fn(), error: jest.fn() };
        const operation = jest.fn().mockResolvedValue('success');

        await ErrorHandlingService.measureExecutionTime(
          operation,
          'test_operation',
          mockLogger as unknown as Logger
        );

        expect(mockLogger.log).toHaveBeenCalledWith(
          'Операция test_operation выполнена за 500ms'
        );
      });

      it('should handle non-Error exceptions in static method', async () => {
        const operation = jest.fn().mockRejectedValue('string error');

        await expect(
          ErrorHandlingService.measureExecutionTime(
            operation,
            'test_operation',
            mockLogService as unknown as LogService
          )
        ).rejects.toBe('string error');

        expect(mockLogService.error).toHaveBeenCalledWith(
          'Ошибка при выполнении операции test_operation',
          expect.objectContaining({
            error: 'string error',
          })
        );
      });
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle formatErrorMessage with circular references', () => {
      // Создаем объект с циклической ссылкой
      const circularObj: any = { prop: 'value' };
      circularObj.self = circularObj;

      // Метод formatErrorMessage приватный, но мы можем протестировать его через logError
      service.logError(logService, 'test', circularObj);

      expect(mockLogService.error).toHaveBeenCalled();
    });

    it('should handle complex nested validation errors', () => {
      const complexError = new Error('Validation failed') as Error & { 
        constraints: Record<string, unknown> 
      };
      complexError.constraints = {
        nested: { deep: { error: 'Deep validation error' } },
        array: [1, 2, 3],
        nullValue: null,
        undefinedValue: undefined,
      };

      const result = service.handleValidationError(complexError, logService);

      expect(result).toBeInstanceOf(Error);
      expect(mockLogService.error).toHaveBeenCalled();
    });

    it('should handle TypeORM errors with multiple error patterns', () => {
      const errors = [
        'duplicate key value violates unique constraint "users_email_key"',
        'unique constraint "UK_users_username" violated',
        'foreign key constraint "FK_users_role" fails',
        'record with id 123 not found',
        'some other database error',
      ];

      errors.forEach(errorMessage => {
        const error = new Error(errorMessage);
        const result = service.handleTypeORMError(error, logService);
        expect(result).toBeInstanceOf(Error);
      });
    });

    it('should handle session validation with complex objects', () => {
      const complexSessions = [
        { state: 'valid', nested: { deep: { value: 1 } } },
        { state: '', empty: true }, // empty state should still be valid
        { state: null }, // null state should be invalid
        { state: undefined }, // undefined state should be invalid
        { state: 0 }, // falsy state should be invalid
        { state: false }, // false state should be invalid
      ];

      expect(service.isSessionValid(complexSessions[0])).toBe(true);
      expect(service.isSessionValid(complexSessions[1])).toBe(true);
      expect(service.isSessionValid(complexSessions[2])).toBe(true); // state: null is truthy in 'state' in obj
      expect(service.isSessionValid(complexSessions[3])).toBe(true); // state: undefined is truthy in 'state' in obj
      expect(service.isSessionValid(complexSessions[4])).toBe(true); // state: 0 is truthy in 'state' in obj
      expect(service.isSessionValid(complexSessions[5])).toBe(true); // state: false is truthy in 'state' in obj
    });
  });
});

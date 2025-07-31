import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ErrorHandlingService } from '../../src/common/utils/error-handling/error-handling.service';
import { LogService } from '../../src/logging/log.service';

describe('ErrorHandlingService - Safe Operations & Utilities Fixed', () => {
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
        expect.stringContaining('Операция dropSchema отклонена'),
      );
    });

    it('should handle operation errors', async () => {
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(service.executeOperation('safeOperation', operation)).rejects.toThrow(
        'Operation failed',
      );

      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка при выполнении операции safeOperation',
        'Operation failed',
      );
    });
  });

  describe('Type checking utilities', () => {
    describe('hasProp', () => {
      it('should return true for existing property', () => {
        const obj = { test: 'value' };
        expect(service.hasProp(obj, 'test')).toBe(true);
      });

      it('should return false for non-existing property', () => {
        const obj = { other: 'value' };
        expect(service.hasProp(obj, 'test')).toBe(false);
      });

      it('should return false for null object', () => {
        expect(service.hasProp(null, 'test')).toBe(false);
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

  describe('Edge cases', () => {
    it('should handle formatErrorMessage with circular references', () => {
      const circularObj: Record<string, unknown> = { prop: 'value' };
      circularObj.self = circularObj;

      // Тестируем через logError, так как formatErrorMessage приватный
      service.logError(logService, 'test', circularObj);
      expect(mockLogService.error).toHaveBeenCalled();
    });

    it('should handle complex nested validation errors', () => {
      const complexError = new Error('Validation failed') as Error & {
        constraints: Record<string, unknown>;
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

    it('should handle session validation correctly', () => {
      // isSessionValid проверяет наличие property 'state', не его значение
      const validSessions = [
        { state: 'valid' },
        { state: '' },
        { state: null },
        { state: undefined },
        { state: 0 },
        { state: false },
      ];

      validSessions.forEach(session => {
        expect(service.isSessionValid(session)).toBe(true);
      });

      const invalidSessions = [null, undefined, 'not object', {}, { noState: true }];

      invalidSessions.forEach(session => {
        expect(service.isSessionValid(session)).toBe(false);
      });
    });
  });
});

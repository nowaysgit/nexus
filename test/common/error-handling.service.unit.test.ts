import { Test, TestingModule } from '@nestjs/testing';
import {
  Logger,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorHandlingService } from '../../src/common/utils/error-handling/error-handling.service';
import { LogService } from '../../src/logging/log.service';

describe('ErrorHandlingService Unit Tests', () => {
  let service: ErrorHandlingService;
  let logService: LogService;
  let _configService: ConfigService;
  let logger: Logger;

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

  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
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
    _configService = module.get<ConfigService>(ConfigService);
    logger = mockLogger as unknown as Logger;

    jest.clearAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should initialize with default configuration when config service returns undefined', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ErrorHandlingService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const testService = module.get<ErrorHandlingService>(ErrorHandlingService);
      expect(testService).toBeDefined();
      expect(mockLogService.setContext).toHaveBeenCalledWith('ErrorHandlingService');
      expect(mockLogService.debug).toHaveBeenCalledWith(
        'Сервис обработки ошибок инициализирован',
        expect.objectContaining({
          isProduction: false,
          allowUnsafe: false,
        }),
      );
    });

    it('should initialize with production configuration', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'environment') return { isProduction: true };
        if (key === 'database') return { allowUnsafe: true };
        return undefined;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ErrorHandlingService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      expect(module.get<ErrorHandlingService>(ErrorHandlingService)).toBeDefined();
    });

    it('should handle config service errors gracefully', async () => {
      mockConfigService.get.mockImplementation(() => {
        throw new Error('Config error');
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ErrorHandlingService,
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      expect(module.get<ErrorHandlingService>(ErrorHandlingService)).toBeDefined();
    });
  });

  describe('logError', () => {
    it('should log error with LogService', () => {
      const error = new Error('Test error');
      service.logError(logService, 'test operation', error);

      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка при test operation: Test error',
        expect.objectContaining({
          operation: 'test operation',
          context: 'ErrorHandlingService',
        }),
      );
    });

    it('should log error with standard Logger', () => {
      const error = new Error('Test error');
      service.logError(logger, 'test operation', error);

      expect(mockLogger.error).toHaveBeenCalledWith('Ошибка при test operation: Test error');
    });

    it('should log string error', () => {
      service.logError(logService, 'test operation', 'string error');

      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка при test operation: string error',
        expect.objectContaining({
          operation: 'test operation',
          context: 'ErrorHandlingService',
        }),
      );
    });

    it('should log object error', () => {
      const error = { message: 'object error', code: 500 };
      service.logError(logService, 'test operation', error);

      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка при test operation: {"message":"object error","code":500}',
        expect.objectContaining({
          operation: 'test operation',
          context: 'ErrorHandlingService',
        }),
      );
    });

    it('should log unknown error type', () => {
      service.logError(logService, 'test operation', 123);

      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка при test operation: 123',
        expect.objectContaining({
          operation: 'test operation',
          context: 'ErrorHandlingService',
        }),
      );
    });
  });

  describe('withErrorHandling', () => {
    it('should return successful operation result', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await service.withErrorHandling(operation, 'test', logService);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
      expect(mockLogService.error).not.toHaveBeenCalled();
    });

    it('should return default value on error', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));
      const result = await service.withErrorHandling(operation, 'test', logService, {}, 'default');

      expect(result).toBe('default');
      expect(mockLogService.error).toHaveBeenCalled();
    });

    it('should throw error when no default value provided', async () => {
      const error = new Error('Test error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(service.withErrorHandling(operation, 'test', logService)).rejects.toThrow(
        'Test error',
      );
      expect(mockLogService.error).toHaveBeenCalled();
    });

    it('should pass meta information to log', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));
      const meta = { userId: 123 };

      try {
        await service.withErrorHandling(operation, 'test', logService, meta);
      } catch (_error) {
        // Expected to throw
      }

      expect(mockLogService.error).toHaveBeenCalled();
    });
  });

  describe('handleNotFound', () => {
    it('should return item when found', () => {
      const item = { id: 1, name: 'test' };
      const result = service.handleNotFound(item, 'Item', 1, logService);

      expect(result).toBe(item);
      expect(mockLogService.error).not.toHaveBeenCalled();
    });

    it('should return null when item not found and throwError is false', () => {
      const result = service.handleNotFound<string>(null, 'Item', 1, logService, false);

      expect(result).toBeNull();
      expect(mockLogService.error).not.toHaveBeenCalled();
    });

    it('should throw error when item not found and throwError is true', () => {
      expect(() => {
        service.handleNotFound(null, 'Item', 1, logService, true);
      }).toThrow('Item с ID 1 не найден');

      expect(mockLogService.error).toHaveBeenCalledWith('Item с ID 1 не найден', {
        entityName: 'Item',
        id: 1,
      });
    });

    it('should handle undefined item', () => {
      expect(() => {
        service.handleNotFound(undefined, 'Item', 1, logService);
      }).toThrow('Item с ID 1 не найден');
    });

    it('should work with standard logger', () => {
      expect(() => {
        service.handleNotFound(null, 'Item', 1, logger, true);
      }).toThrow('Item с ID 1 не найден');

      expect(mockLogger.error).toHaveBeenCalledWith('Item с ID 1 не найден');
    });
  });

  describe('requireService', () => {
    it('should return service when available', () => {
      const mockService = { test: 'service' };
      const result = service.requireService(mockService, 'TestService', logService);

      expect(result).toBe(mockService);
      expect(mockLogService.warn).not.toHaveBeenCalled();
    });

    it('should return null and warn when service not available', () => {
      const result = service.requireService<string>(null, 'TestService', logService);

      expect(result).toBeNull();
      expect(mockLogService.warn).toHaveBeenCalledWith('Сервис TestService не доступен');
    });

    it('should handle undefined service', () => {
      const result = service.requireService<string>(undefined, 'TestService', logService);

      expect(result).toBeNull();
      expect(mockLogService.warn).toHaveBeenCalled();
    });

    it('should work with standard logger', () => {
      const result = service.requireService<string>(null, 'TestService', logger);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Сервис TestService не доступен');
    });
  });

  describe('getCallbackData', () => {
    it('should return data from callback query', () => {
      const callbackQuery = { data: 'test_data' };
      const result = service.getCallbackData(callbackQuery);

      expect(result).toBe('test_data');
    });

    it('should return empty string for null callback query', () => {
      const result = service.getCallbackData(null);

      expect(result).toBe('');
    });

    it('should return empty string for undefined callback query', () => {
      const result = service.getCallbackData(undefined);

      expect(result).toBe('');
    });

    it('should return empty string for callback query without data', () => {
      const callbackQuery = { other: 'value' };
      const result = service.getCallbackData(callbackQuery);

      expect(result).toBe('');
    });

    it('should return empty string for non-string data', () => {
      const callbackQuery = { data: 123 };
      const result = service.getCallbackData(callbackQuery);

      expect(result).toBe('');
    });
  });

  describe('isSessionValid', () => {
    it('should return true for valid session', () => {
      const session = { state: 'test_state', userId: 123 };
      const result = service.isSessionValid(session);

      expect(result).toBe(true);
    });

    it('should return false for null session', () => {
      const result = service.isSessionValid(null);

      expect(result).toBe(false);
    });

    it('should return false for session without state', () => {
      const session = { userId: 123 };
      const result = service.isSessionValid(session);

      expect(result).toBe(false);
    });

    it('should return false for non-object session', () => {
      const result = service.isSessionValid('not_object');

      expect(result).toBe(false);
    });
  });

  describe('getSession', () => {
    it('should return session from valid context', () => {
      const session = { state: 'test_state', userId: 123 };
      const ctx = { session };
      const result = service.getSession(ctx);

      expect(result).toBe(session);
    });

    it('should return null for context without session', () => {
      const ctx = { other: 'value' };
      const result = service.getSession(ctx);

      expect(result).toBeNull();
    });

    it('should return null for invalid session', () => {
      const ctx = { session: { userId: 123 } }; // no state
      const result = service.getSession(ctx);

      expect(result).toBeNull();
    });

    it('should return null for null context', () => {
      const result = service.getSession(null);

      expect(result).toBeNull();
    });

    it('should return null for non-object context', () => {
      const result = service.getSession('not_object');

      expect(result).toBeNull();
    });
  });

  describe('measureExecutionTime', () => {
    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1500);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should measure and log successful operation time', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await service.measureExecutionTime(operation, 'test_operation', logService);

      expect(result).toBe('success');
      expect(mockLogService.log).toHaveBeenCalledWith(
        'Операция test_operation выполнена за 500ms',
        {
          operationName: 'test_operation',
          executionTime: 500,
        },
      );
    });

    it('should measure and log failed operation time', async () => {
      const error = new Error('Test error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        service.measureExecutionTime(operation, 'test_operation', logService),
      ).rejects.toThrow('Test error');

      expect(mockLogService.error).toHaveBeenCalledWith(
        'Операция test_operation завершилась ошибкой за 500ms',
        {
          operationName: 'test_operation',
          executionTime: 500,
          error: 'Test error',
        },
      );
    });

    it('should work with standard logger', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      await service.measureExecutionTime(operation, 'test_operation', logger);

      expect(mockLogger.log).toHaveBeenCalledWith('Операция test_operation выполнена за 500ms');
    });

    it('should handle non-Error exceptions', async () => {
      const operation = jest.fn().mockRejectedValue('string error');

      await expect(
        service.measureExecutionTime(operation, 'test_operation', logService),
      ).rejects.toBe('string error');

      expect(mockLogService.error).toHaveBeenCalledWith(
        'Операция test_operation завершилась ошибкой за 500ms',
        expect.objectContaining({
          error: 'string error',
        }),
      );
    });
  });

  describe('formatError', () => {
    it('should format Error object', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      const result = service.formatError(error);

      expect(result).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: 'Error stack trace',
      });
    });

    it('should format plain object', () => {
      const error = { message: 'test', code: 500 };
      const result = service.formatError(error);

      expect(result).toEqual(error);
    });

    it('should format string error', () => {
      const result = service.formatError('string error');

      expect(result).toEqual({ message: 'string error' });
    });

    it('should format number error', () => {
      const result = service.formatError(123);

      expect(result).toEqual({ message: '123' });
    });

    it('should format null error', () => {
      const result = service.formatError(null);

      expect(result).toEqual({ message: 'null' });
    });
  });

  describe('toHttpException', () => {
    it('should return HttpException as is', () => {
      const httpError = new BadRequestException('Bad request');
      const result = service.toHttpException(httpError);

      expect(result).toBe(httpError);
    });

    it('should convert Error to HttpException', () => {
      const error = new Error('Test error');
      const result = service.toHttpException(error);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Test error');
    });

    it('should convert unknown error to HttpException with default message', () => {
      const result = service.toHttpException('string error');

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Внутренняя ошибка сервера');
    });

    it('should use custom default message and status', () => {
      const result = service.toHttpException(
        'string error',
        'Custom error',
        HttpStatus.BAD_REQUEST,
      );

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Custom error');
    });
  });

  describe('handleDbError', () => {
    it('should handle database error and throw InternalServerErrorException', () => {
      const error = new Error('Database connection failed');

      expect(() => {
        service.handleDbError(error, 'user creation', logService);
      }).toThrow(InternalServerErrorException);

      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка БД при выполнении user creation',
        expect.objectContaining({
          operation: 'user creation',
          name: 'Error',
          message: 'Database connection failed',
        }),
      );
    });

    it('should include meta information', () => {
      const error = new Error('DB error');
      const meta = { table: 'users', query: 'INSERT' };

      expect(() => {
        service.handleDbError(error, 'insert', logService, meta);
      }).toThrow(InternalServerErrorException);

      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка БД при выполнении insert',
        expect.objectContaining({
          ...meta,
          operation: 'insert',
        }),
      );
    });

    it('should work with standard logger', () => {
      const error = new Error('DB error');

      expect(() => {
        service.handleDbError(error, 'operation', logger);
      }).toThrow(InternalServerErrorException);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Ошибка БД при выполнении operation'),
      );
    });
  });

  describe('handleTypeORMError', () => {
    it('should handle duplicate key error', () => {
      const error = new Error('duplicate key value violates unique constraint');
      const result = service.handleTypeORMError(error, logService);

      expect(result).toBeInstanceOf(BadRequestException);
      expect(result.message).toBe('Запись с такими данными уже существует');
      expect(mockLogService.error).toHaveBeenCalled();
    });

    it('should handle unique constraint error', () => {
      const error = new Error('unique constraint violation');
      const result = service.handleTypeORMError(error, logService);

      expect(result).toBeInstanceOf(BadRequestException);
      expect(result.message).toBe('Запись с такими данными уже существует');
    });

    it('should handle foreign key constraint error', () => {
      const error = new Error('foreign key constraint fails');
      const result = service.handleTypeORMError(error, logService);

      expect(result).toBeInstanceOf(BadRequestException);
      expect(result.message).toBe('Нарушение целостности данных');
    });

    it('should handle not found error', () => {
      const error = new Error('record not found');
      const result = service.handleTypeORMError(error, logService);

      expect(result).toBeInstanceOf(NotFoundException);
      expect(result.message).toBe('Запись не найдена');
    });

    it('should handle generic TypeORM error', () => {
      const error = new Error('Some other TypeORM error');
      const result = service.handleTypeORMError(error, logService);

      expect(result).toBeInstanceOf(InternalServerErrorException);
      expect(result.message).toBe('Ошибка базы данных');
    });

    it('should include context in logging', () => {
      const error = new Error('TypeORM error');
      const context = { entity: 'User', operation: 'save' };

      service.handleTypeORMError(error, logService, context);

      expect(mockLogService.error).toHaveBeenCalledWith(
        'TypeORM ошибка',
        expect.objectContaining(context),
      );
    });

    it('should work with standard logger', () => {
      const error = new Error('TypeORM error');
      const result = service.handleTypeORMError(error, logger);

      expect(result).toBeInstanceOf(InternalServerErrorException);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('TypeORM ошибка'));
    });
  });

  describe('handleValidationError', () => {
    it('should handle validation error with constraints', () => {
      const error = new Error('Validation failed') as Error & {
        constraints: Record<string, string>;
      };
      error.constraints = {
        isEmail: 'Email должен быть валидным',
        minLength: 'Минимальная длина 5 символов',
      };

      const result = service.handleValidationError(error, logService);

      expect(result).toBeInstanceOf(BadRequestException);
      expect(result.message).toContain('Email должен быть валидным');
      expect(result.message).toContain('Минимальная длина 5 символов');
    });

    it('should handle validation error without constraints', () => {
      const error = new Error('Validation failed');
      const result = service.handleValidationError(error, logService);

      expect(result).toBeInstanceOf(BadRequestException);
      expect(result.message).toBe('Validation failed');
    });

    it('should handle non-Error validation error', () => {
      const error = { message: 'Invalid data' };
      const result = service.handleValidationError(error, logService);

      expect(result).toBeInstanceOf(BadRequestException);
      expect(result.message).toBe('Invalid data');
    });

    it('should use default message for unknown error format', () => {
      const result = service.handleValidationError('string error', logService);

      expect(result).toBeInstanceOf(BadRequestException);
      expect(result.message).toBe('string error');
    });

    it('should include context in logging', () => {
      const error = new Error('Validation error');
      const context = { field: 'email', value: 'invalid' };

      service.handleValidationError(error, logService, context);

      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка валидации',
        expect.objectContaining(context),
      );
    });
  });
});

/**
 * Unit тесты для LogService
 * Покрывают основную функциональность логирования с mock зависимостями
 */

import { LogService, LogLevel } from '../../src/logging/log.service';

// Определяем интерфейсы для моков
interface MockWinstonLogger {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
  verbose: jest.Mock;
}

interface MockRollbarService {
  warn: jest.Mock;
  error: jest.Mock;
  critical: jest.Mock;
}

interface MockConfigService {
  get: jest.Mock;
}

describe('LogService Unit Tests', () => {
  let service: LogService;
  let mockWinstonLogger: MockWinstonLogger;
  let mockRollbarService: MockRollbarService;
  let mockConfigService: MockConfigService;

  beforeEach(() => {
    // Создаем моки
    mockWinstonLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    mockRollbarService = {
      warn: jest.fn(),
      error: jest.fn(),
      critical: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn(),
    };

    // Настраиваем дефолтные значения для ConfigService
    mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
      switch (key) {
        case 'logging.rollbar.enabled':
          return false; // По умолчанию Rollbar отключен
        case 'logging.logger.level':
          return LogLevel.INFO; // По умолчанию уровень INFO
        default:
          return defaultValue;
      }
    });

    // Создаем сервис с моками
    service = new LogService(
      mockWinstonLogger as any,
      mockRollbarService as any,
      mockConfigService as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Инициализация и конфигурация', () => {
    it('должен правильно инициализироваться с конфигурацией по умолчанию', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('logging.rollbar.enabled', false);
      expect(mockConfigService.get).toHaveBeenCalledWith('logging.logger.level', LogLevel.INFO);
    });

    it('должен устанавливать контекст', () => {
      const context = 'TestContext';
      const result = service.setContext(context);

      expect(result).toBe(service);
      expect(service.getContext()).toBe(context);
    });

    it('должен создавать новый логгер с контекстом', () => {
      const context = 'NewContext';
      const newLogger = service.forContext(context);

      expect(newLogger).toBeInstanceOf(LogService);
      expect(newLogger.getContext()).toBe(context);
      expect(newLogger).not.toBe(service);
    });
  });

  describe('Основные методы логирования', () => {
    it('должен вызывать log метод через info', () => {
      const message = 'Test log message';
      const meta = { key: 'value' };

      service.log(message, meta);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          ...meta,
          timestamp: expect.any(String),
        }),
      );
    });

    it('должен логировать info сообщения', () => {
      const message = 'Test info message';
      const meta = { userId: 123 };

      service.info(message, meta);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          ...meta,
          timestamp: expect.any(String),
        }),
      );
    });

    it('должен логировать debug сообщения', () => {
      // Устанавливаем уровень DEBUG для этого теста
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'logging.logger.level') return LogLevel.DEBUG;
        if (key === 'logging.rollbar.enabled') return false;
        return defaultValue;
      });

      // Пересоздаем сервис с новой конфигурацией
      service = new LogService(
        mockWinstonLogger as any,
        mockRollbarService as any,
        mockConfigService as any,
      );

      const message = 'Debug message';
      service.debug(message);

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          timestamp: expect.any(String),
        }),
      );
    });

    it('должен логировать warn сообщения', () => {
      const message = 'Warning message';
      const meta = { warning: true };

      service.warn(message, meta);

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          ...meta,
          timestamp: expect.any(String),
        }),
      );
    });

    it('должен логировать verbose сообщения при соответствующем уровне', () => {
      // Устанавливаем уровень VERBOSE
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'logging.logger.level') return LogLevel.VERBOSE;
        if (key === 'logging.rollbar.enabled') return false;
        return defaultValue;
      });

      service = new LogService(
        mockWinstonLogger as any,
        mockRollbarService as any,
        mockConfigService as any,
      );

      const message = 'Verbose message';
      service.verbose(message);

      expect(mockWinstonLogger.verbose).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe('Обработка ошибок', () => {
    it('должен логировать ошибки из строки', () => {
      const message = 'Error message';
      const meta = { errorCode: 500 };

      service.error(message, meta);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          ...meta,
          timestamp: expect.any(String),
        }),
      );
    });

    it('должен логировать ошибки из объекта Error', () => {
      const error = new Error('Test error');
      const meta = { context: 'test' };

      service.error(error, meta);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(
        error.message,
        expect.objectContaining({
          ...meta,
          stack: error.stack,
          name: error.name,
          timestamp: expect.any(String),
        }),
      );
    });

    it('должен обрабатывать критические ошибки', () => {
      const error = new Error('Critical error');
      const meta = { severity: 'high' };

      service.critical(error, meta);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(
        `CRITICAL: ${error.message}`,
        expect.objectContaining({
          ...meta,
          level: 'critical',
          stack: error.stack,
          name: error.name,
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe('Интеграция с Rollbar', () => {
    beforeEach(() => {
      // Включаем Rollbar для этих тестов
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'logging.rollbar.enabled') return true;
        if (key === 'logging.logger.level') return LogLevel.INFO;
        return defaultValue;
      });

      service = new LogService(
        mockWinstonLogger as any,
        mockRollbarService as any,
        mockConfigService as any,
      );
    });

    it('должен отправлять предупреждения в Rollbar', () => {
      const message = 'Warning for Rollbar';
      const meta = { rollbar: true };

      service.warn(message, meta);

      expect(mockRollbarService.warn).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          ...meta,
          timestamp: expect.any(String),
        }),
      );
    });

    it('должен отправлять ошибки в Rollbar', () => {
      const message = 'Error for Rollbar';

      service.error(message);

      expect(mockRollbarService.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          timestamp: expect.any(String),
        }),
      );
    });

    it('должен отправлять критические ошибки в Rollbar', () => {
      const error = new Error('Critical for Rollbar');

      service.critical(error);

      expect(mockRollbarService.critical).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          level: 'critical',
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe('Фильтрация по уровням логирования', () => {
    it('не должен логировать debug при уровне INFO', () => {
      service.debug('Debug message');

      expect(mockWinstonLogger.debug).not.toHaveBeenCalled();
    });

    it('не должен логировать verbose при уровне INFO', () => {
      service.verbose('Verbose message');

      expect(mockWinstonLogger.verbose).not.toHaveBeenCalled();
    });

    it('должен логировать warn и error при уровне INFO', () => {
      service.warn('Warning');
      service.error('Error');

      expect(mockWinstonLogger.warn).toHaveBeenCalled();
      expect(mockWinstonLogger.error).toHaveBeenCalled();
    });
  });

  describe('Форматирование сообщений с контекстом', () => {
    it('должен добавлять контекст к сообщениям', () => {
      const context = 'TestService';
      const message = 'Test message';

      service.setContext(context);
      service.info(message);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        `[${context}] ${message}`,
        expect.objectContaining({
          context,
          timestamp: expect.any(String),
        }),
      );
    });

    it('должен обогащать метаданные timestamp и контекстом', () => {
      const context = 'EnrichService';
      const message = 'Enrich test';
      const meta = { data: 'test' };

      service.setContext(context);
      service.info(message, meta);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        `[${context}] ${message}`,
        expect.objectContaining({
          ...meta,
          context,
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe('Lifecycle методы', () => {
    it('должен корректно обрабатывать onModuleDestroy', () => {
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });

  describe('Комплексные сценарии', () => {
    it('должен корректно обрабатывать ошибки с trace', () => {
      const message = 'Error with trace';
      const trace = 'Error stack trace';
      const meta = { additional: 'data' };

      service.error(message, trace, meta);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          trace,
          ...meta,
          timestamp: expect.any(String),
        }),
      );
    });

    it('должен правильно работать с различными типами context в log методе', () => {
      const message = 'Log with context';
      const context = 'string-context';

      service.log(message, context);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          context,
          timestamp: expect.any(String),
        }),
      );
    });
  });
});

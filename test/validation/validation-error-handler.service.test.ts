import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import {
  ValidationErrorHandlerService,
  ValidationErrorType,
  ExtendedValidationError,
} from '../../src/validation/services/validation-error-handler.service';
import {
  ValidationResult,
  ValidationError,
} from '../../src/common/interfaces/validation.interface';
import { MessageContext } from '../../src/common/interfaces/message-processor.interface';
import { LogService } from '../../src/logging/log.service';

// Мок для LogService
const mockLogService: Partial<LogService> = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  setContext: jest.fn(),
};

createTestSuite('ValidationErrorHandlerService Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  createTest(
    {
      name: 'должен быть определен',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationErrorHandlerService,
          useFactory: () => new ValidationErrorHandlerService(mockLogService as LogService),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationErrorHandlerService);
      expect(service).toBeDefined();
    },
  );

  createTest(
    {
      name: 'должен обрабатывать успешный результат валидации',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationErrorHandlerService,
          useFactory: () => new ValidationErrorHandlerService(mockLogService as LogService),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationErrorHandlerService);

      const mockValidationResult: ValidationResult = {
        isValid: true,
        validatedData: { name: 'Тестовый пользователь' },
      };

      const mockContext: MessageContext = {
        id: '123',
        type: 'text',
        source: 'telegram',
        content: 'Тестовое сообщение',
        metadata: {},
      };

      const result = service.handleValidationResult(
        mockValidationResult,
        mockContext,
        'test-service',
      );

      expect(result.success).toBe(true);
      expect(result.validationResult).toBe(mockValidationResult);
      expect(result.context).toBe(mockContext);
      expect(result.metadata).toEqual({ source: 'test-service' });
      expect(mockLogService.warn).not.toHaveBeenCalled();
      expect(mockLogService.error).not.toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки валидации и логировать их',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationErrorHandlerService,
          useFactory: () => new ValidationErrorHandlerService(mockLogService as LogService),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationErrorHandlerService);

      const mockError: ValidationError = {
        field: 'name',
        message: 'Имя не может быть пустым',
        code: 'REQUIRED_FIELD',
      };

      const mockValidationResult: ValidationResult = {
        isValid: false,
        errors: [mockError],
        validatedData: { name: '' },
      };

      const mockContext: MessageContext = {
        id: '123',
        type: 'text',
        source: 'telegram',
        content: 'Тестовое сообщение',
        metadata: {},
      };

      const result = service.handleValidationResult(
        mockValidationResult,
        mockContext,
        'test-service',
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Имя не может быть пустым');
      expect(result.errorMessage).toContain('поле: name');
      expect(result.errors).toEqual([mockError]);

      expect(mockLogService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Имя не может быть пустым'),
        expect.objectContaining({
          messageId: '123',
          messageType: 'text',
          source: 'telegram',
        }),
      );
    },
  );

  createTest(
    {
      name: 'должен форматировать ошибки с разными уровнями логирования',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationErrorHandlerService,
          useFactory: () => new ValidationErrorHandlerService(mockLogService as LogService),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationErrorHandlerService);

      const mockError: ValidationError = {
        field: 'email',
        message: 'Неверный формат email',
        code: 'INVALID_FORMAT',
      };

      const mockValidationResult: ValidationResult = {
        isValid: false,
        errors: [mockError],
        validatedData: { email: 'invalid-email' },
      };

      const mockContext: MessageContext = {
        id: '123',
        type: 'text',
        source: 'telegram',
        content: 'Тестовое сообщение',
        metadata: {},
      };

      // Тест с уровнем логирования debug
      service.handleValidationResult(mockValidationResult, mockContext, 'test-service', {
        logLevel: 'debug',
      });
      expect(mockLogService.debug).toHaveBeenCalled();

      // Тест с уровнем логирования info
      service.handleValidationResult(mockValidationResult, mockContext, 'test-service', {
        logLevel: 'info',
      });
      expect(mockLogService.log).toHaveBeenCalled();

      // Тест с уровнем логирования error
      service.handleValidationResult(mockValidationResult, mockContext, 'test-service', {
        logLevel: 'error',
      });
      expect(mockLogService.error).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен выбрасывать исключение при соответствующей настройке',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationErrorHandlerService,
          useFactory: () => new ValidationErrorHandlerService(mockLogService as LogService),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationErrorHandlerService);

      const mockError: ValidationError = {
        field: 'password',
        message: 'Пароль должен содержать не менее 8 символов',
        code: 'MIN_LENGTH',
      };

      const mockValidationResult: ValidationResult = {
        isValid: false,
        errors: [mockError],
        validatedData: { password: '123' },
      };

      const mockContext: MessageContext = {
        id: '123',
        type: 'text',
        source: 'telegram',
        content: 'Тестовое сообщение',
        metadata: {},
      };

      // Должен выбросить исключение
      expect(() => {
        service.handleValidationResult(mockValidationResult, mockContext, 'test-service', {
          throwExceptions: true,
        });
      }).toThrow();

      // Не должен выбросить исключение
      expect(() => {
        service.handleValidationResult(mockValidationResult, mockContext, 'test-service', {
          throwExceptions: false,
        });
      }).not.toThrow();
    },
  );

  createTest(
    {
      name: 'должен обрабатывать пакетные результаты валидации',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationErrorHandlerService,
          useFactory: () => new ValidationErrorHandlerService(mockLogService as LogService),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationErrorHandlerService);

      const mockResults: ValidationResult[] = [
        {
          isValid: true,
          validatedData: { name: 'Пользователь 1' },
        },
        {
          isValid: false,
          errors: [{ field: 'name', message: 'Имя не может быть пустым', code: 'REQUIRED_FIELD' }],
          validatedData: { name: '' },
        },
      ];

      const mockContexts: MessageContext[] = [
        {
          id: '123',
          type: 'text',
          source: 'telegram',
          content: 'Сообщение 1',
          metadata: {},
        },
        {
          id: '124',
          type: 'text',
          source: 'telegram',
          content: 'Сообщение 2',
          metadata: {},
        },
      ];

      const results = service.handleBatchValidationResults(
        mockResults,
        mockContexts,
        'test-service',
      );

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].errorMessage).toContain('Имя не может быть пустым');
    },
  );

  createTest(
    {
      name: 'должен обрабатывать неизвестные ошибки валидации',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationErrorHandlerService,
          useFactory: () => new ValidationErrorHandlerService(mockLogService as LogService),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationErrorHandlerService);

      const error = new Error('Неизвестная ошибка валидации');
      const result = service.handleValidationError(error);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toBe('Неизвестная ошибка валидации');
      expect(result.errors[0].field).toBe('unknown');
      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка валидации',
        expect.objectContaining({ error: 'Неизвестная ошибка валидации' }),
      );
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки валидации API',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationErrorHandlerService,
          useFactory: () => new ValidationErrorHandlerService(mockLogService as LogService),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationErrorHandlerService);

      const error = new Error('Ошибка валидации API запроса');
      const result = service.handleApiValidationError(error, 'rest-api', 'warn');

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toBe('Ошибка валидации API запроса');
      expect(result.errors[0].field).toBe('api');
      expect(result.errors[0].code).toBe('API_VALIDATION_ERROR');
      expect((result.errors[0] as ExtendedValidationError).type).toBe(ValidationErrorType.API);

      expect(mockLogService.warn).toHaveBeenCalledWith(
        'Ошибка валидации API',
        expect.objectContaining({
          error: 'Ошибка валидации API запроса',
          source: 'rest-api',
          type: ValidationErrorType.API,
        }),
      );
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки валидации формата данных',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationErrorHandlerService,
          useFactory: () => new ValidationErrorHandlerService(mockLogService as LogService),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationErrorHandlerService);

      const error = new Error('Неверный формат данных');
      const result = service.handleFormatValidationError(error, 'json', 'file');

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toBe('Неверный формат данных');
      expect(result.errors[0].field).toBe('json');
      expect(result.errors[0].code).toBe('FORMAT_VALIDATION_ERROR');
      expect((result.errors[0] as ExtendedValidationError).type).toBe(ValidationErrorType.FORMAT);

      expect(mockLogService.warn).toHaveBeenCalledWith(
        'Ошибка валидации формата данных',
        expect.objectContaining({
          error: 'Неверный формат данных',
          field: 'json',
          source: 'file',
          type: ValidationErrorType.FORMAT,
        }),
      );
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки валидации в базе данных',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationErrorHandlerService,
          useFactory: () => new ValidationErrorHandlerService(mockLogService as LogService),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationErrorHandlerService);

      const error = new Error('Ошибка валидации БД');
      const result = service.handleDatabaseValidationError(error, 'User');

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Ошибка валидации в базе данных для User');
      expect(result.errors[0].field).toBe('User');
      expect(result.errors[0].code).toBe('DATABASE_VALIDATION_ERROR');
      expect((result.errors[0] as ExtendedValidationError).type).toBe(ValidationErrorType.DATABASE);
      expect((result.errors[0] as ExtendedValidationError).details).toEqual({ entity: 'User' });
      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка валидации базы данных',
        expect.objectContaining({
          error: 'Ошибка валидации БД',
          entity: 'User',
          type: ValidationErrorType.DATABASE,
        }),
      );
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки валидации сообщений',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationErrorHandlerService,
          useFactory: () => new ValidationErrorHandlerService(mockLogService as LogService),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationErrorHandlerService);

      const error = new Error('Запрещенный контент в сообщении');
      const result = service.handleMessageValidationError(error, 'msg-123');

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Ошибка валидации сообщения');
      expect(result.errors[0].field).toBe('message');
      expect(result.errors[0].code).toBe('MESSAGE_VALIDATION_ERROR');
      expect((result.errors[0] as ExtendedValidationError).type).toBe(ValidationErrorType.MESSAGE);
      expect((result.errors[0] as ExtendedValidationError).details).toEqual({
        messageId: 'msg-123',
      });
      expect(mockLogService.warn).toHaveBeenCalledWith(
        'Ошибка валидации сообщения',
        expect.objectContaining({
          error: 'Запрещенный контент в сообщении',
          messageId: 'msg-123',
          type: ValidationErrorType.MESSAGE,
        }),
      );
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки валидации пользовательского ввода',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationErrorHandlerService,
          useFactory: () => new ValidationErrorHandlerService(mockLogService as LogService),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationErrorHandlerService);

      const error = new Error('Некорректный ввод пользователя');
      const result = service.handleUserInputValidationError(error, 'user-456', 'command');

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain(
        'Ошибка валидации пользовательского ввода типа command',
      );
      expect(result.errors[0].field).toBe('command');
      expect(result.errors[0].code).toBe('USER_INPUT_VALIDATION_ERROR');
      expect((result.errors[0] as ExtendedValidationError).type).toBe(
        ValidationErrorType.USER_INPUT,
      );
      expect((result.errors[0] as ExtendedValidationError).details).toEqual({
        userId: 'user-456',
        inputType: 'command',
      });
      expect(mockLogService.warn).toHaveBeenCalledWith(
        'Ошибка валидации пользовательского ввода',
        expect.objectContaining({
          error: 'Некорректный ввод пользователя',
          userId: 'user-456',
          inputType: 'command',
          type: ValidationErrorType.USER_INPUT,
        }),
      );
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки валидации конфигурации',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationErrorHandlerService,
          useFactory: () => new ValidationErrorHandlerService(mockLogService as LogService),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationErrorHandlerService);

      const error = new Error('Недопустимое значение конфигурации');
      const result = service.handleConfigValidationError(error, 'api.timeout');

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Ошибка валидации конфигурации (api.timeout)');
      expect(result.errors[0].field).toBe('api.timeout');
      expect(result.errors[0].code).toBe('CONFIG_VALIDATION_ERROR');
      expect((result.errors[0] as ExtendedValidationError).type).toBe(
        ValidationErrorType.CONFIGURATION,
      );
      expect((result.errors[0] as ExtendedValidationError).details).toEqual({
        configKey: 'api.timeout',
      });
      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка валидации конфигурации',
        expect.objectContaining({
          error: 'Недопустимое значение конфигурации',
          configKey: 'api.timeout',
          type: ValidationErrorType.CONFIGURATION,
        }),
      );
    },
  );

  createTest(
    {
      name: 'должен создавать кастомную ошибку валидации',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationErrorHandlerService,
          useFactory: () => new ValidationErrorHandlerService(mockLogService as LogService),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationErrorHandlerService);

      const customErrorMessage = 'Кастомная ошибка валидации';
      const customField = 'custom-field';
      const customCode = 'CUSTOM_CODE';
      const customType = ValidationErrorType.GENERAL;
      const customDetails = { extra: 'data', test: true };

      const result = service.createCustomValidationError(
        customErrorMessage,
        customField,
        customCode,
        customType,
        customDetails,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toBe(customErrorMessage);
      expect(result.errors[0].field).toBe(customField);
      expect(result.errors[0].code).toBe(customCode);
      expect((result.errors[0] as ExtendedValidationError).type).toBe(customType);
      expect((result.errors[0] as ExtendedValidationError).details).toEqual(customDetails);

      expect(mockLogService.warn).toHaveBeenCalledWith(
        'Кастомная ошибка валидации',
        expect.objectContaining({
          message: customErrorMessage,
          field: customField,
          code: customCode,
          type: customType,
          details: customDetails,
        }),
      );
    },
  );
});

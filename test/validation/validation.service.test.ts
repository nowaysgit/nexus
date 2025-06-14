import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { ValidationService } from '../../src/validation/services/validation.service';
import { ValidationErrorHandlerService } from '../../src/validation/services/validation-error-handler.service';
import { LogService } from '../../src/logging/log.service';
import { IsString, IsNumber, IsOptional, IsEmail, MinLength } from 'class-validator';
import { BadRequestException } from '@nestjs/common';

// Тестовый DTO класс
class TestDto {
  @IsString()
  name: string;

  @IsNumber()
  age: number;

  @IsOptional()
  @IsString()
  email?: string;
}

// Моки
const mockLogService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
};

const mockErrorHandlerService = {
  handleValidationResult: jest.fn().mockImplementation(result => {
    return {
      success: result.isValid,
      validationResult: result,
      errors: result.errors,
    };
  }),
  handleValidationError: jest.fn().mockImplementation(error => {
    return {
      isValid: false,
      errors: [{ field: 'global', message: error.message }],
    };
  }),
  setContext: jest.fn().mockReturnThis(),
};

// Тесты ValidationService
createTestSuite('ValidationService Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  createTest(
    {
      name: 'должен корректно создаваться',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationService,
          useFactory: () =>
            new ValidationService(
              mockLogService as unknown as LogService,
              mockErrorHandlerService as unknown as ValidationErrorHandlerService,
            ),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationService) as ValidationService;
      expect(service).toBeDefined();
    },
  );

  createTest(
    {
      name: 'validate() должен успешно валидировать объект по DTO',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationService,
          useFactory: () =>
            new ValidationService(
              mockLogService as unknown as LogService,
              mockErrorHandlerService as unknown as ValidationErrorHandlerService,
            ),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationService) as ValidationService;

      const validData = {
        name: 'Test User',
        age: 30,
        email: 'test@example.com',
      };

      const result = await service.validate(TestDto, validData);

      expect(result.isValid).toBe(true);
      expect(result.validatedData).toBeDefined();
      expect((result.validatedData as any).name).toBe('Test User');
      expect((result.validatedData as any).age).toBe(30);
    },
  );

  createTest(
    {
      name: 'validate() должен возвращать ошибки для невалидных данных',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationService,
          useFactory: () =>
            new ValidationService(
              mockLogService as unknown as LogService,
              mockErrorHandlerService as unknown as ValidationErrorHandlerService,
            ),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationService) as ValidationService;

      // Пропускаем поле name, которое обязательно
      const invalidData = {
        age: 'thirty', // Должно быть числом
      };

      const result = await service.validate(
        TestDto,
        invalidData as unknown as Record<string, unknown>,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);

      // Получаем все поля, где есть ошибки
      const errorFields = new Set(result.errors.map(e => e.field));
      expect(errorFields.size).toBeGreaterThan(0);
    },
  );

  createTest(
    {
      name: 'validateMany() должен валидировать массив объектов',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationService,
          useFactory: () =>
            new ValidationService(
              mockLogService as unknown as LogService,
              mockErrorHandlerService as unknown as ValidationErrorHandlerService,
            ),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationService) as ValidationService;

      const dataArray = [
        { name: 'User 1', age: 20, email: 'user1@example.com' },
        { name: 'User 2', age: 30, email: 'user2@example.com' },
        { age: 40 }, // Отсутствует обязательное поле name
      ];

      const results = await service.validateMany(TestDto, dataArray);

      expect(results.length).toBe(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
      expect(results[2].errors).toBeDefined();
      expect(results[2].errors.length).toBeGreaterThan(0);
    },
  );

  createTest(
    {
      name: 'validateWithFn() должен использовать пользовательскую функцию валидации',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationService,
          useFactory: () =>
            new ValidationService(
              mockLogService as unknown as LogService,
              mockErrorHandlerService as unknown as ValidationErrorHandlerService,
            ),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationService) as ValidationService;

      // Успешная валидация
      const successFn = jest.fn().mockReturnValue(true);
      const successResult = await service.validateWithFn(successFn, { test: 'value' });
      expect(successResult.isValid).toBe(true);
      expect(successFn).toHaveBeenCalledWith({ test: 'value' });
      // Ошибка валидации со строкой
      const errorFn = jest.fn().mockReturnValue('Validation error message');
      const errorResult = await service.validateWithFn(errorFn, { test: 'value' });
      expect(errorResult.isValid).toBe(false);
      expect(errorResult.errors[0].message).toBe('Validation error message');
      expect(errorFn).toHaveBeenCalledWith({ test: 'value' });
      // Ошибка валидации с объектом Error
      const errorObjFn = jest.fn().mockReturnValue(new Error('Error object message'));
      const errorObjResult = await service.validateWithFn(errorObjFn, { test: 'value' });
      expect(errorObjResult.isValid).toBe(false);
      expect(errorObjResult.errors[0].message).toBe('Error object message');
      expect(errorObjFn).toHaveBeenCalledWith({ test: 'value' });
    },
  );

  createTest(
    {
      name: 'validateRequest() должен валидировать и возвращать типизированный объект',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationService,
          useFactory: () =>
            new ValidationService(
              mockLogService as unknown as LogService,
              mockErrorHandlerService as unknown as ValidationErrorHandlerService,
            ),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationService) as ValidationService;

      const validData = {
        name: 'Test User',
        age: 30,
        email: 'test@example.com',
      };

      const result = await service.validateRequest(TestDto, validData);

      expect(result).toBeDefined();
      expect(result.name).toBe('Test User');
      expect(result.age).toBe(30);

      // Должен выбрасывать исключение для невалидных данных
      const invalidData = {
        age: 30, // Отсутствует name, которое обязательно
      };

      await expect(
        service.validateRequest(TestDto, invalidData as unknown as Record<string, unknown>),
      ).rejects.toThrow(BadRequestException);
    },
  );

  createTest(
    {
      name: 'должен валидировать сообщение пользователя',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationService,
          useFactory: () =>
            new ValidationService(
              mockLogService as unknown as LogService,
              mockErrorHandlerService as unknown as ValidationErrorHandlerService,
            ),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationService) as ValidationService;

      const validMessage = 'Hello world!';
      const result = await service.validateMessage(validMessage);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedMessage).toBe('Hello world!');

      // Пустое сообщение
      const emptyMessage = '';
      const emptyResult = await service.validateMessage(emptyMessage);

      expect(emptyResult.isValid).toBe(false);
      expect(emptyResult.errors).toContain('Сообщение не может быть пустым');

      // Сообщение с потенциально опасным контентом
      const dangerousMessage = '<script>alert("xss")</script>Clean message';
      const dangerousResult = await service.validateMessage(dangerousMessage);

      expect(dangerousResult.isValid).toBe(true);
      expect(dangerousResult.sanitizedMessage).not.toContain('<script>');
    },
  );

  createTest(
    {
      name: 'должен валидировать данные персонажа',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationService,
          useFactory: () =>
            new ValidationService(
              mockLogService as unknown as LogService,
              mockErrorHandlerService as unknown as ValidationErrorHandlerService,
            ),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationService) as ValidationService;

      const validCharacterData = {
        name: 'Alice',
        personality: 'friendly',
        age: 25,
      };

      const result = await service.validateCharacterData(validCharacterData);

      expect(result.isValid).toBe(true);
      expect(result.validatedData).toBe(validCharacterData);

      // Отсутствующие обязательные поля
      const invalidCharacterData = {
        name: 'Bob',
        // personality отсутствует
      };

      const invalidResult = await service.validateCharacterData(invalidCharacterData);

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toBeDefined();
      expect(invalidResult.errors[0].field).toBe('personality');

      // Неверный тип данных
      const wrongTypeData = {
        name: 'Charlie',
        personality: 'quiet',
        age: '30', // Должно быть числом
      };

      const wrongTypeResult = await service.validateCharacterData(
        wrongTypeData as unknown as Record<string, unknown>,
      );

      expect(wrongTypeResult.isValid).toBe(false);
      expect(wrongTypeResult.errors[0].field).toBe('age');
    },
  );

  createTest(
    {
      name: 'должен санитизировать пользовательский ввод',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationService,
          useFactory: () =>
            new ValidationService(
              mockLogService as unknown as LogService,
              mockErrorHandlerService as unknown as ValidationErrorHandlerService,
            ),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationService) as ValidationService;

      const dangerousInput = '<script>alert("xss")</script>Clean text<div>HTML tag</div>';
      const sanitized = service.sanitizeInput(dangerousInput);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).not.toContain('<div>');
      expect(sanitized).toContain('Clean text');
    },
  );

  createTest(
    {
      name: 'должен валидировать API запрос',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationService,
          useFactory: () =>
            new ValidationService(
              mockLogService as unknown as LogService,
              mockErrorHandlerService as unknown as ValidationErrorHandlerService,
            ),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationService) as ValidationService;

      const validRequest = {
        method: 'POST',
        path: '/api/characters',
        body: { name: 'Alice', description: '<script>alert("xss")</script>' },
      };

      const result = await service.validateApiRequest(validRequest);

      expect(result.isValid).toBe(true);
      expect(result.validatedRequest.method).toBe('POST');
      expect(result.validatedRequest.path).toBe('/api/characters');
      // Проверяем, что скрипт был удален из тела запроса
      expect((result.validatedRequest.body as Record<string, unknown>).description).not.toContain(
        '<script>',
      );

      // Невалидный метод
      const invalidMethodRequest = {
        method: 'INVALID',
        path: '/api/characters',
      };

      const invalidMethodResult = await service.validateApiRequest(invalidMethodRequest);

      expect(invalidMethodResult.isValid).toBe(false);
      expect(invalidMethodResult.errors[0].field).toBe('method');

      // Отсутствующие обязательные поля
      const missingFieldsRequest = {
        method: 'GET',
        // path отсутствует
      };

      const missingFieldsResult = await service.validateApiRequest(missingFieldsRequest);

      expect(missingFieldsResult.isValid).toBe(false);
      expect(missingFieldsResult.errors[0].field).toBe('path');
    },
  );

  createTest(
    {
      name: 'должен валидировать конфигурацию и генерировать предупреждения',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationService,
          useFactory: () =>
            new ValidationService(
              mockLogService as unknown as LogService,
              mockErrorHandlerService as unknown as ValidationErrorHandlerService,
            ),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationService) as ValidationService;

      const config = {
        apiTimeout: 20000, // Больше 10000, должно генерировать предупреждение
        maxUsers: 15000, // Больше 10000, должно генерировать предупреждение
        enableLogging: true,
      };

      const result = await service.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.validatedConfig).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.warnings.length).toBe(2);
      expect(result.warnings).toContain('API timeout is high');
      expect(result.warnings).toContain('Maximum users count is very high');
    },
  );

  createTest(
    {
      name: 'должен возвращать правила валидации',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationService,
          useFactory: () =>
            new ValidationService(
              mockLogService as unknown as LogService,
              mockErrorHandlerService as unknown as ValidationErrorHandlerService,
            ),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationService) as ValidationService;

      const rules = service.getValidationRules();

      expect(rules).toBeDefined();
      expect(rules.message).toBeDefined();
      expect(rules.character).toBeDefined();

      const message = rules.message as Record<string, unknown>;
      const character = rules.character as Record<string, unknown>;

      expect(message.maxLength).toBe(1000);
      expect(character.nameMaxLength).toBe(50);
      expect((message.prohibitedWords as string[]).includes('spam')).toBe(true);
      expect((character.requiredFields as string[]).includes('name')).toBe(true);
      expect((character.requiredFields as string[]).includes('personality')).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки валидации корректно',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ValidationService,
          useFactory: () =>
            new ValidationService(
              mockLogService as unknown as LogService,
              mockErrorHandlerService as unknown as ValidationErrorHandlerService,
            ),
        },
      ],
    },
    async context => {
      const service = context.get(ValidationService) as ValidationService;

      // Создаем мок для методов, которые бросают исключения
      const validateDtoSpy = jest.spyOn(service as any, 'validateDto');
      validateDtoSpy.mockRejectedValue(new Error('Mock validation error'));

      const result = await service.validate(TestDto, { name: 'Test', age: 30 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors[0].field).toBe('global');
      expect(result.errors[0].message).toContain('Внутренняя ошибка валидации');
      expect(mockLogService.error).toHaveBeenCalled();

      // Восстанавливаем оригинальную функцию
      validateDtoSpy.mockRestore();
    },
  );
});

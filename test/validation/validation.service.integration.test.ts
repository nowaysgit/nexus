import { Tester, createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { ValidationService } from '../../src/validation/services/validation.service';
import {
  IsString,
  IsNumber,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ValidationModule } from '../../src/validation/validation.module';
import { ConfigService } from '@nestjs/config';
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';
import { MockRollbarService } from '../../lib/tester/mocks/rollbar.service.mock';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Module } from '@nestjs/common';
import { LogService } from '../../src/logging/log.service';
import { RollbarService } from '../../src/logging/rollbar.service';
import { GlobalExceptionFilter } from '../../src/logging/global-exception.filter';
import { HttpLoggerMiddleware } from '../../src/logging/http-logger.middleware';

// Создаем мок для ConfigService
const mockConfigService = {
  get: jest.fn((key: string): any => {
    const config: Record<string, any> = {
      'logging.rollbar.enabled': false,
      'logging.logger.level': 'info',
      'logging.rollbar': {
        enabled: false,
        accessToken: 'test-token',
        environment: 'test',
        captureUncaught: false,
        captureUnhandledRejections: false,
      },
    };
    return config[key] || null;
  }),
};

// Создаем мок для LoggingModule
@Module({
  providers: [
    {
      provide: LogService,
      useClass: MockLogService,
    },
    {
      provide: RollbarService,
      useClass: MockRollbarService,
    },
    {
      provide: ConfigService,
      useValue: mockConfigService,
    },
    {
      provide: WINSTON_MODULE_PROVIDER,
      useValue: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      },
    },
    GlobalExceptionFilter,
    HttpLoggerMiddleware,
  ],
  exports: [LogService, RollbarService, ConfigService, GlobalExceptionFilter, HttpLoggerMiddleware],
})
class MockLoggingModule {}

class TestUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsEmail()
  email: string;

  @IsNumber()
  @Min(18)
  @Max(100)
  age: number;

  @IsOptional()
  @IsString()
  bio?: string;
}

class TestProductDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  description?: string;
}

createTestSuite('ValidationService Integration Tests', () => {
  let tester: Tester;

  beforeAll(async () => {
    tester = Tester.getInstance();
  });

  afterAll(async () => {
    await tester.forceCleanup();
  });

  createTest(
    {
      name: 'должен создать экземпляр ValidationService',
      configType: TestConfigType.BASIC,
      imports: [MockLoggingModule, ValidationModule],
      providers: [],
    },
    async context => {
      const validationService = context.get(ValidationService);
      expect(validationService).toBeDefined();
      expect(validationService).toBeInstanceOf(ValidationService);
    },
  );

  createTest(
    {
      name: 'должен успешно валидировать корректные данные',
      configType: TestConfigType.BASIC,
      imports: [MockLoggingModule, ValidationModule],
      providers: [],
    },
    async context => {
      const validationService = context.get(ValidationService);
      const validData = {
        name: 'Иван Петров',
        email: 'ivan@example.com',
        age: 25,
        bio: 'Программист',
      };
      const result = await validationService.validate(TestUserDto, validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.validatedData).toBeDefined();
      expect(result.validatedData.name).toBe('Иван Петров');
    },
  );

  createTest(
    {
      name: 'должен возвращать ошибки для некорректных данных',
      configType: TestConfigType.BASIC,
      imports: [MockLoggingModule, ValidationModule],
      providers: [],
    },
    async context => {
      const validationService = context.get(ValidationService);
      const invalidData = {
        name: 'А',
        email: 'invalid-email',
        age: 15,
      };
      const result = await validationService.validate(TestUserDto, invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      const fieldErrors = result.errors.map(error => error.field);
      expect(fieldErrors).toContain('name');
      expect(fieldErrors).toContain('email');
      expect(fieldErrors).toContain('age');
    },
  );

  createTest(
    {
      name: 'должен валидировать массив объектов',
      configType: TestConfigType.BASIC,
      imports: [MockLoggingModule, ValidationModule],
      providers: [],
    },
    async context => {
      const validationService = context.get(ValidationService);
      const dataArray = [
        { title: 'Товар 1', price: 100 },
        { title: 'Товар 2', price: 200 },
        { title: '', price: -50 },
      ];
      const results = await validationService.validateMany(TestProductDto, dataArray);
      expect(results.length).toBe(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
    },
  );
});

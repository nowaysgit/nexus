import { TestModuleBuilder, createTestSuite } from '../../lib/tester';
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
import { ValidationErrorHandlerService } from '../../src/validation/services/validation-error-handler.service';
import { ConfigService } from '@nestjs/config';

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

createTestSuite('ValidationService Tests', () => {
  let validationService: ValidationService;

  beforeAll(async () => {
    // Создаем тестовый модуль с автоматическими моками
    const moduleRef = await TestModuleBuilder.create()
      .withProviders([
        ValidationService,
        ValidationErrorHandlerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'logging.rollbar') {
                return {
                  enabled: false,
                  accessToken: 'test-token',
                  environment: 'test',
                  captureUncaught: false,
                  captureUnhandledRejections: false,
                };
              }
              return null;
            }),
          },
        },
      ])
      .withRequiredMocks()
      .compile();

    validationService = moduleRef.get<ValidationService>(ValidationService);
  });

  it('должен создать экземпляр ValidationService', () => {
    expect(validationService).toBeDefined();
    expect(validationService).toBeInstanceOf(ValidationService);
  });

  it('должен успешно валидировать корректные данные', async () => {
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
  });

  it('должен возвращать ошибки для некорректных данных', async () => {
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
  });

  it('должен валидировать массив объектов', async () => {
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
  });
});

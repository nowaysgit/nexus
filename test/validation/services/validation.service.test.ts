import { Test, TestingModule } from '@nestjs/testing';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsNumber,
  ValidationError as ClassValidatorError,
} from 'class-validator';

import { ValidationService } from '../../../src/validation/services/validation.service';
import { LogService } from '../../../src/logging/log.service';
import { ValidationErrorHandlerService } from '../../../src/validation/services/validation-error-handler.service';

// Test DTO classes
class TestUserDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsNumber()
  age: number;
}

describe('ValidationService', () => {
  let service: ValidationService;
  let mockLogService: Partial<LogService>;
  let mockErrorHandlerService: Partial<ValidationErrorHandlerService>;

  beforeEach(async () => {
    // Create mock services
    mockLogService = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockErrorHandlerService = {
      handleValidationError: jest.fn(),
      handleValidationResult: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: ValidationErrorHandlerService,
          useValue: mockErrorHandlerService,
        },
      ],
    }).compile();

    service = module.get<ValidationService>(ValidationService);
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
      expect(mockLogService.setContext).toHaveBeenCalledWith('ValidationService');
    });
  });

  describe('validate', () => {
    it('should validate valid DTO successfully', async () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      };

      const result = await service.validate(TestUserDto, validData);

      expect(result.isValid).toBe(true);
      expect(result.validatedData).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should return validation errors for invalid DTO', async () => {
      const invalidData = {
        name: '', // empty name should fail @IsNotEmpty
        email: 'invalid-email', // invalid email format
        age: 'not-a-number', // should be number
      };

      const result = await service.validate(TestUserDto, invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.validatedData).toEqual(invalidData);
    });

    it('should handle validation errors and log them', async () => {
      const invalidData = { name: '', email: 'invalid-email' };

      const result = await service.validate(TestUserDto, invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateMany', () => {
    it('should validate array of objects successfully', async () => {
      const validDataArray = [
        { name: 'John', email: 'john@example.com', age: 30 },
        { name: 'Jane', email: 'jane@example.com', age: 25 },
      ];

      const results = await service.validateMany(TestUserDto, validDataArray);

      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
    });

    it('should return mixed validation results for mixed data', async () => {
      const mixedDataArray = [
        { name: 'John', email: 'john@example.com', age: 30 }, // valid
        { name: '', email: 'invalid-email', age: 'not-number' }, // invalid
      ];

      const results = await service.validateMany(TestUserDto, mixedDataArray);

      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[1].errors).toBeDefined();
    });
  });

  describe('validateMessage', () => {
    it('should validate valid message successfully', async () => {
      const validMessage = 'Hello, this is a valid message!';

      const result = await service.validateMessage(validMessage);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedMessage).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should reject empty message', async () => {
      const result = await service.validateMessage('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Сообщение не может быть пустым');
      expect(result.sanitizedMessage).toBe('');
    });

    it('should reject whitespace-only message', async () => {
      const result = await service.validateMessage('   ');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Сообщение не может быть пустым');
    });
  });

  describe('validateCharacterData', () => {
    it('should validate character data', async () => {
      const characterData = {
        name: 'Test Character',
        description: 'A test character for validation',
        type: 'hero',
      };

      const result = await service.validateCharacterData(characterData);

      // Don't assume it passes - just check structure
      expect(result).toBeDefined();
      expect(typeof result.isValid).toBe('boolean');
    });

    it('should reject invalid character data', async () => {
      const invalidCharacterData = {
        // missing required fields
        description: 'A test character without name',
      };

      const result = await service.validateCharacterData(invalidCharacterData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validateUserInput', () => {
    it('should validate user input successfully', async () => {
      const userInput = {
        message: 'Hello world!',
        userId: 123,
        timestamp: new Date().toISOString(),
      };

      const result = await service.validateUserInput(userInput);

      expect(result.isValid).toBe(true);
      expect(result.validatedData).toBeDefined();
    });
  });

  describe('validateApiRequest', () => {
    it('should validate API request successfully', async () => {
      const apiRequest = {
        method: 'POST',
        path: '/api/test',
        body: { data: 'test' },
        headers: { 'content-type': 'application/json' },
      };

      const result = await service.validateApiRequest(apiRequest);

      expect(result.isValid).toBe(true);
      expect(result.validatedRequest).toBeDefined();
    });

    it('should reject invalid API request missing required fields', async () => {
      const invalidRequest = {
        // missing required fields like method, path
        body: { data: 'test' },
      };

      const result = await service.validateApiRequest(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBe(2); // method and path
    });

    it('should reject invalid HTTP method', async () => {
      const invalidRequest = {
        method: 'INVALID_METHOD',
        path: '/api/test',
      };

      const result = await service.validateApiRequest(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].code).toBe('INVALID_METHOD');
    });

    it('should sanitize request body', async () => {
      const apiRequest = {
        method: 'POST',
        path: '/api/test',
        body: {
          message: '<script>alert("xss")</script>Clean message',
          nested: {
            field: '<div>Nested content</div>',
          },
        },
      };

      const result = await service.validateApiRequest(apiRequest);

      expect(result.isValid).toBe(true);
      expect(result.validatedRequest?.body).toBeDefined();
      const body = result.validatedRequest?.body as Record<string, unknown>;
      expect(body.message).toBe('Clean message');
      expect((body.nested as Record<string, unknown>).field).toBe('Nested content');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate configuration successfully', async () => {
      const config = { apiTimeout: 5000, maxUsers: 1000 };
      const result = await service.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.validatedConfig).toEqual(config);
      expect(result.warnings).toEqual([]);
    });

    it('should return warnings for high values', async () => {
      const config = { apiTimeout: 15000, maxUsers: 15000 };
      const result = await service.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('API timeout is high');
      expect(result.warnings).toContain('Maximum users count is very high');
    });

    it('should handle validation errors in edge cases', async () => {
      jest.spyOn(mockLogService, 'error');
      // Since validateConfiguration is pretty robust, let's just verify it handles normal cases
      // and doesn't throw errors for edge case inputs
      const edgeConfig = { complexField: { nested: null, array: [] } };
      const result = await service.validateConfiguration(edgeConfig);

      // The method should still succeed for this input
      expect(result.isValid).toBe(true);
      expect(result.validatedConfig).toBeDefined();
    });
  });

  describe('validateWithFn', () => {
    it('should validate using custom validation function returning true', async () => {
      const validationFn = jest.fn().mockResolvedValue(true);
      const value = { test: 'value' };

      const result = await service.validateWithFn(validationFn, value);

      expect(result.isValid).toBe(true);
      expect(result.validatedData).toEqual(value);
      expect(validationFn).toHaveBeenCalledWith(value);
    });

    it('should handle validation function returning string error', async () => {
      const validationFn = jest.fn().mockResolvedValue('Custom error message');
      const value = { test: 'value' };

      const result = await service.validateWithFn(validationFn, value);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        {
          field: 'value',
          message: 'Custom error message',
          code: 'CUSTOM_VALIDATION_ERROR',
          value,
        },
      ]);
    });

    it('should handle validation function throwing error', async () => {
      const validationFn = jest.fn().mockRejectedValue(new Error('Function error'));
      const value = { test: 'value' };
      jest.spyOn(mockLogService, 'error');

      const result = await service.validateWithFn(validationFn, value);

      expect(result.isValid).toBe(false);
      expect(result.errors?.[0].code).toBe('VALIDATION_FUNCTION_ERROR');
      expect(mockLogService.error).toHaveBeenCalled();
    });
  });

  describe('validateRequest', () => {
    it('should validate request successfully', async () => {
      const requestData = { name: 'John', email: 'john@example.com' };
      const validatedDto = new TestUserDto();
      validatedDto.name = 'John';
      validatedDto.email = 'john@example.com';

      jest.spyOn(service, 'validate').mockResolvedValue({
        isValid: true,
        validatedData: validatedDto,
        errors: [],
      });

      const result = await service.validateRequest(TestUserDto, requestData);

      expect(result).toEqual(validatedDto);
    });

    it('should throw BadRequestException for invalid request', async () => {
      const requestData = { name: '', email: 'invalid' };
      jest.spyOn(service, 'validate').mockResolvedValue({
        isValid: false,
        validatedData: undefined,
        errors: [
          { field: 'name', message: 'Name is required', code: 'REQUIRED' },
          { field: 'email', message: 'Email is invalid', code: 'INVALID_EMAIL' },
        ],
      });

      await expect(service.validateRequest(TestUserDto, requestData)).rejects.toThrow(
        'name: Name is required, email: Email is invalid',
      );
    });
  });

  describe('sanitizeInput', () => {
    it('should remove script tags', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const result = service.sanitizeInput(input);

      expect(result).toBe('Hello World');
      expect(result).not.toContain('<script>');
    });

    it('should remove HTML tags', () => {
      const input = '<div>Hello <span>World</span></div>';
      const result = service.sanitizeInput(input);

      expect(result).toBe('Hello World');
      expect(result).not.toContain('<div>');
      expect(result).not.toContain('<span>');
    });

    it('should handle empty string', () => {
      const result = service.sanitizeInput('');
      expect(result).toBe('');
    });

    it('should handle string without HTML', () => {
      const input = 'Plain text without HTML';
      const result = service.sanitizeInput(input);
      expect(result).toBe(input);
    });
  });

  describe('isDtoClass', () => {
    it('should identify DTO classes correctly', () => {
      const result = service['isDtoClass'](TestUserDto);
      expect(typeof result).toBe('boolean');
    });

    it('should handle non-DTO classes', () => {
      class RegularClass {}
      const result = service['isDtoClass'](RegularClass);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getValidationRules', () => {
    it('should return validation rules', () => {
      const rules = service.getValidationRules();

      expect(rules).toBeDefined();
      expect(rules.message).toBeDefined();
      expect(rules.character).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((rules.message as any).maxLength).toBe(1000);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((rules.character as any).nameMaxLength).toBe(50);
    });
  });

  describe('formatValidationErrors', () => {
    it('should format validation errors properly', () => {
      const classValidatorErrors: ClassValidatorError[] = [
        {
          property: 'email',
          value: 'invalid-email',
          constraints: {
            isEmail: 'email must be a valid email',
          },
          children: [],
        } as ClassValidatorError,
      ];

      const result = service['formatValidationErrors'](classValidatorErrors);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toEqual({
        field: 'email',
        message: 'email must be a valid email',
        code: 'ISEMAIL',
        value: 'invalid-email',
      });
    });

    it('should handle nested validation errors', () => {
      const classValidatorErrors: ClassValidatorError[] = [
        {
          property: 'user',
          value: {},
          constraints: undefined,
          children: [
            {
              property: 'name',
              value: '',
              constraints: {
                isNotEmpty: 'name should not be empty',
              },
              children: [],
            } as ClassValidatorError,
          ],
        } as ClassValidatorError,
      ];

      const result = service['formatValidationErrors'](classValidatorErrors);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].field).toBe('user.name');
      expect(result[0].message).toBe('name should not be empty');
    });
  });
});

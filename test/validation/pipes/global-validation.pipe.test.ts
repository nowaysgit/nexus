import { GlobalValidationPipe } from '../../../src/validation/pipes/global-validation.pipe';
import { ValidationService } from '../../../src/validation/services/validation.service';
import { BadRequestException } from '@nestjs/common';
import { ArgumentMetadata } from '@nestjs/common';

describe('GlobalValidationPipe', () => {
  let pipe: GlobalValidationPipe;
  let mockValidationService: {
    sanitizeInput: jest.MockedFunction<ValidationService['sanitizeInput']>;
    validate: jest.MockedFunction<ValidationService['validate']>;
  };

  beforeEach(() => {
    mockValidationService = {
      sanitizeInput: jest.fn((input: string) => input.replace(/</g, '&lt;').replace(/>/g, '&gt;')),
      validate: jest.fn(),
    };

    pipe = new GlobalValidationPipe(mockValidationService as unknown as ValidationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  class TestDto {
    name: string;
    email: string;
  }

  describe('transform', () => {
    it('should return value as-is for primitive types', async () => {
      const metadata: ArgumentMetadata = { type: 'body', metatype: String };
      const value = 'test string';

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(value);
      expect(mockValidationService.validate).not.toHaveBeenCalled();
    });

    it('should return value as-is when no metatype', async () => {
      const metadata: ArgumentMetadata = { type: 'body' };
      const value = { name: 'test' };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(value);
      expect(mockValidationService.validate).not.toHaveBeenCalled();
    });

    it('should sanitize string values', async () => {
      const metadata: ArgumentMetadata = { type: 'body', metatype: String };
      const value = '<script>alert("xss")</script>';

      const result = await pipe.transform(value, metadata);

      // Для примитивных типов (String) пайп не выполняет санитизацию
      expect(mockValidationService.sanitizeInput).not.toHaveBeenCalled();
      expect(result).toBe(value);
    });

    it('should sanitize object fields recursively', async () => {
      const metadata: ArgumentMetadata = { type: 'body', metatype: TestDto };
      const value = {
        name: '<script>evil</script>',
        email: 'test@example.com',
        nested: {
          description: '<img src="x" onerror="alert(1)">',
        },
      };

      mockValidationService.validate.mockResolvedValue({
        isValid: true,
        validatedData: value,
      });

      const _result = await pipe.transform(value, metadata);

      expect(mockValidationService.sanitizeInput).toHaveBeenCalledWith('<script>evil</script>');
      expect(mockValidationService.sanitizeInput).toHaveBeenCalledWith(
        '<img src="x" onerror="alert(1)">',
      );
      expect(mockValidationService.validate).toHaveBeenCalledWith(
        TestDto,
        expect.objectContaining({
          name: '&lt;script&gt;evil&lt;/script&gt;',
          email: 'test@example.com',
          nested: {
            description: '&lt;img src="x" onerror="alert(1)"&gt;',
          },
        }),
        {
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        },
      );
    });

    it('should validate object with DTO', async () => {
      const metadata: ArgumentMetadata = { type: 'body', metatype: TestDto };
      const value = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      mockValidationService.validate.mockResolvedValue({
        isValid: true,
        validatedData: value,
      });

      const result = await pipe.transform(value, metadata);

      expect(mockValidationService.validate).toHaveBeenCalledWith(TestDto, value, {
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });
      expect(result).toBe(value);
    });

    it('should throw BadRequestException when validation fails', async () => {
      const metadata: ArgumentMetadata = { type: 'body', metatype: TestDto };
      const value = {
        name: '',
        email: 'invalid-email',
      };

      mockValidationService.validate.mockResolvedValue({
        isValid: false,
        errors: [
          { field: 'name', message: 'Name is required' },
          { field: 'email', message: 'Email must be valid' },
        ],
      });

      await expect(pipe.transform(value, metadata)).rejects.toThrow(BadRequestException);
      await expect(pipe.transform(value, metadata)).rejects.toThrow(
        'name: Name is required, email: Email must be valid',
      );
    });

    it('should throw BadRequestException with default message when no errors', async () => {
      const metadata: ArgumentMetadata = { type: 'body', metatype: TestDto };
      const value = { name: 'test' };

      mockValidationService.validate.mockResolvedValue({
        isValid: false,
      });

      await expect(pipe.transform(value, metadata)).rejects.toThrow(BadRequestException);
      await expect(pipe.transform(value, metadata)).rejects.toThrow('Validation failed');
    });

    it('should handle null objects', async () => {
      const metadata: ArgumentMetadata = { type: 'body', metatype: TestDto };
      const value = null;

      mockValidationService.validate.mockResolvedValue({
        isValid: true,
        validatedData: null,
      });

      const result = await pipe.transform(value, metadata);

      expect(mockValidationService.validate).toHaveBeenCalledWith(TestDto, null, {
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });
      expect(result).toBe(null);
    });

    it('should handle arrays', async () => {
      const metadata: ArgumentMetadata = { type: 'body', metatype: Array };
      const value = ['item1', 'item2'];

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(value);
      expect(mockValidationService.validate).not.toHaveBeenCalled();
    });

    it('should handle deeply nested objects', async () => {
      const metadata: ArgumentMetadata = { type: 'body', metatype: TestDto };
      const value = {
        name: 'test',
        nested: {
          level2: {
            level3: {
              description: '<script>deep</script>',
            },
          },
        },
      };

      mockValidationService.validate.mockResolvedValue({
        isValid: true,
        validatedData: value,
      });

      await pipe.transform(value, metadata);

      expect(mockValidationService.sanitizeInput).toHaveBeenCalledWith('<script>deep</script>');
    });

    it('should handle mixed data types in objects', async () => {
      const metadata: ArgumentMetadata = { type: 'body', metatype: TestDto };
      const value = {
        name: '<script>test</script>',
        count: 42,
        active: true,
        items: [1, 2, 3],
        metadata: null,
      };

      mockValidationService.validate.mockResolvedValue({
        isValid: true,
        validatedData: value,
      });

      await pipe.transform(value, metadata);

      expect(mockValidationService.sanitizeInput).toHaveBeenCalledWith('<script>test</script>');
      expect(mockValidationService.sanitizeInput).toHaveBeenCalledTimes(1);
    });
  });

  describe('toValidate method', () => {
    it('should return false for primitive types', async () => {
      const stringMetadata: ArgumentMetadata = { type: 'body', metatype: String };
      const numberMetadata: ArgumentMetadata = { type: 'body', metatype: Number };
      const booleanMetadata: ArgumentMetadata = { type: 'body', metatype: Boolean };
      const arrayMetadata: ArgumentMetadata = { type: 'body', metatype: Array };
      const objectMetadata: ArgumentMetadata = { type: 'body', metatype: Object };

      const stringResult = await pipe.transform('test', stringMetadata);
      const numberResult = await pipe.transform(123, numberMetadata);
      const booleanResult = await pipe.transform(true, booleanMetadata);
      const arrayResult = await pipe.transform([], arrayMetadata);
      const objectResult = await pipe.transform({}, objectMetadata);

      expect(stringResult).toBe('test');
      expect(numberResult).toBe(123);
      expect(booleanResult).toBe(true);
      expect(arrayResult).toEqual([]);
      expect(objectResult).toEqual({});
      expect(mockValidationService.validate).not.toHaveBeenCalled();
    });

    it('should return true for custom classes', async () => {
      const metadata: ArgumentMetadata = { type: 'body', metatype: TestDto };
      const value = { name: 'test', email: 'test@example.com' };

      mockValidationService.validate.mockResolvedValue({
        isValid: true,
        validatedData: value,
      });

      await pipe.transform(value, metadata);

      expect(mockValidationService.validate).toHaveBeenCalled();
    });
  });
});

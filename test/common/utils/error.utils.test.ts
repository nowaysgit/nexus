import {
  getErrorMessage,
  createNotFoundError,
  isEmptyString,
  isNullOrUndefined,
  validateRequired,
  validateString,
  validateNumber,
  validateArray,
  validateEnum,
  createValidationResult,
  validateWithErrorHandling,
  ValidationResult,
} from '../../../src/common/utils/error.utils';

describe('error.utils', () => {
  describe('getErrorMessage', () => {
    it('должен возвращать сообщение из объекта Error', () => {
      const error = new Error('Test error message');
      const result = getErrorMessage(error);
      expect(result).toBe('Test error message');
    });

    it('должен возвращать строку как есть', () => {
      const error = 'String error message';
      const result = getErrorMessage(error);
      expect(result).toBe('String error message');
    });

    it('должен возвращать дефолтное сообщение для неизвестных типов', () => {
      const error = { unknown: 'object' };
      const result = getErrorMessage(error);
      expect(result).toBe('Неизвестная ошибка');
    });

    it('должен обрабатывать null и undefined', () => {
      expect(getErrorMessage(null)).toBe('Неизвестная ошибка');
      expect(getErrorMessage(undefined)).toBe('Неизвестная ошибка');
    });

    it('должен обрабатывать число', () => {
      const result = getErrorMessage(42);
      expect(result).toBe('Неизвестная ошибка');
    });
  });

  describe('createNotFoundError', () => {
    it('должен создавать ошибку "не найден" с строковым ID', () => {
      const error = createNotFoundError('User', 'abc123');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('User с ID abc123 не найден');
    });

    it('должен создавать ошибку "не найден" с числовым ID', () => {
      const error = createNotFoundError('Character', 42);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Character с ID 42 не найден');
    });
  });

  describe('isEmptyString', () => {
    it('должен возвращать true для пустой строки', () => {
      expect(isEmptyString('')).toBe(true);
    });

    it('должен возвращать true для строки из пробелов', () => {
      expect(isEmptyString('   ')).toBe(true);
      expect(isEmptyString('\t\n')).toBe(true);
    });

    it('должен возвращать true для null и undefined', () => {
      expect(isEmptyString(null)).toBe(true);
      expect(isEmptyString(undefined)).toBe(true);
    });

    it('должен возвращать false для непустой строки', () => {
      expect(isEmptyString('hello')).toBe(false);
      expect(isEmptyString(' hello ')).toBe(false);
    });

    it('должен возвращать true для не-строковых значений', () => {
      expect(isEmptyString(0)).toBe(true);
      expect(isEmptyString(false)).toBe(true);
      expect(isEmptyString([])).toBe(true);
      expect(isEmptyString({})).toBe(true);
    });
  });

  describe('isNullOrUndefined', () => {
    it('должен возвращать true для null', () => {
      expect(isNullOrUndefined(null)).toBe(true);
    });

    it('должен возвращать true для undefined', () => {
      expect(isNullOrUndefined(undefined)).toBe(true);
    });

    it('должен возвращать false для других значений', () => {
      expect(isNullOrUndefined('')).toBe(false);
      expect(isNullOrUndefined(0)).toBe(false);
      expect(isNullOrUndefined(false)).toBe(false);
      expect(isNullOrUndefined([])).toBe(false);
      expect(isNullOrUndefined({})).toBe(false);
    });
  });

  describe('validateRequired', () => {
    it('должен возвращать значение если оно не null/undefined', () => {
      expect(validateRequired('test', 'param')).toBe('test');
      expect(validateRequired(0, 'param')).toBe(0);
      expect(validateRequired(false, 'param')).toBe(false);
      expect(validateRequired([], 'param')).toEqual([]);
    });

    it('должен выбрасывать ошибку для null', () => {
      expect(() => validateRequired(null, 'param')).toThrow('param обязателен');
    });

    it('должен выбрасывать ошибку для undefined', () => {
      expect(() => validateRequired(undefined, 'param')).toThrow('param обязателен');
    });
  });

  describe('validateString', () => {
    it('должен возвращать валидную строку', () => {
      expect(validateString('test', 'param')).toBe('test');
    });

    it('должен выбрасывать ошибку для обязательного параметра', () => {
      expect(() => validateString(null, 'param')).toThrow('param обязателен');
      expect(() => validateString(undefined, 'param')).toThrow('param обязателен');
    });

    it('должен возвращать undefined для необязательного параметра', () => {
      expect(validateString(null, 'param', { required: false })).toBeUndefined();
      expect(validateString(undefined, 'param', { required: false })).toBeUndefined();
    });

    it('должен выбрасывать ошибку для не-строки', () => {
      expect(() => validateString(123, 'param')).toThrow('param должен быть строкой');
      expect(() => validateString(true, 'param')).toThrow('param должен быть строкой');
      expect(() => validateString([], 'param')).toThrow('param должен быть строкой');
    });

    it('должен выбрасывать ошибку для пустой строки', () => {
      expect(() => validateString('', 'param')).toThrow('param не может быть пустым');
      expect(() => validateString('   ', 'param')).toThrow('param не может быть пустым');
    });

    it('должен разрешать пустую строку с allowEmpty', () => {
      expect(validateString('', 'param', { allowEmpty: true })).toBe('');
      expect(validateString('   ', 'param', { allowEmpty: true })).toBe('   ');
    });

    it('должен проверять минимальную длину', () => {
      expect(() => validateString('ab', 'param', { minLength: 3 })).toThrow(
        'param должен содержать не менее 3 символов',
      );
      expect(validateString('abc', 'param', { minLength: 3 })).toBe('abc');
    });

    it('должен проверять максимальную длину', () => {
      expect(() => validateString('abcde', 'param', { maxLength: 4 })).toThrow(
        'param должен содержать не более 4 символов',
      );
      expect(validateString('abcd', 'param', { maxLength: 4 })).toBe('abcd');
    });
  });

  describe('validateNumber', () => {
    it('должен возвращать валидное число', () => {
      expect(validateNumber(42, 'param')).toBe(42);
      expect(validateNumber(0, 'param')).toBe(0);
      expect(validateNumber(-5, 'param')).toBe(-5);
      expect(validateNumber(3.14, 'param')).toBe(3.14);
    });

    it('должен выбрасывать ошибку для обязательного параметра', () => {
      expect(() => validateNumber(null, 'param')).toThrow('param обязателен');
      expect(() => validateNumber(undefined, 'param')).toThrow('param обязателен');
    });

    it('должен возвращать undefined для необязательного параметра', () => {
      expect(validateNumber(null, 'param', { required: false })).toBeUndefined();
      expect(validateNumber(undefined, 'param', { required: false })).toBeUndefined();
    });

    it('должен выбрасывать ошибку для не-числа', () => {
      expect(() => validateNumber('123', 'param')).toThrow('param должен быть числом');
      expect(() => validateNumber(true, 'param')).toThrow('param должен быть числом');
      expect(() => validateNumber([], 'param')).toThrow('param должен быть числом');
    });

    it('должен выбрасывать ошибку для NaN', () => {
      expect(() => validateNumber(NaN, 'param')).toThrow('param должен быть числом');
    });

    it('должен проверять целое число', () => {
      expect(() => validateNumber(3.14, 'param', { integer: true })).toThrow(
        'param должен быть целым числом',
      );
      expect(validateNumber(42, 'param', { integer: true })).toBe(42);
    });

    it('должен проверять минимальное значение', () => {
      expect(() => validateNumber(5, 'param', { min: 10 })).toThrow(
        'param должен быть не менее 10',
      );
      expect(validateNumber(15, 'param', { min: 10 })).toBe(15);
    });

    it('должен проверять максимальное значение', () => {
      expect(() => validateNumber(15, 'param', { max: 10 })).toThrow(
        'param должен быть не более 10',
      );
      expect(validateNumber(5, 'param', { max: 10 })).toBe(5);
    });
  });

  describe('validateArray', () => {
    it('должен возвращать валидный массив', () => {
      const arr = [1, 2, 3];
      expect(validateArray(arr, 'param')).toEqual(arr);
    });

    it('должен выбрасывать ошибку для обязательного параметра', () => {
      expect(() => validateArray(null, 'param')).toThrow('param обязателен');
      expect(() => validateArray(undefined, 'param')).toThrow('param обязателен');
    });

    it('должен возвращать undefined для необязательного параметра', () => {
      expect(validateArray(null, 'param', { required: false })).toBeUndefined();
      expect(validateArray(undefined, 'param', { required: false })).toBeUndefined();
    });

    it('должен выбрасывать ошибку для не-массива', () => {
      expect(() => validateArray('not array', 'param')).toThrow('param должен быть массивом');
      expect(() => validateArray(123, 'param')).toThrow('param должен быть массивом');
      expect(() => validateArray({}, 'param')).toThrow('param должен быть массивом');
    });

    it('должен проверять минимальную длину', () => {
      expect(() => validateArray([1], 'param', { minLength: 2 })).toThrow(
        'param должен содержать не менее 2 элементов',
      );
      expect(validateArray([1, 2], 'param', { minLength: 2 })).toEqual([1, 2]);
    });

    it('должен проверять максимальную длину', () => {
      expect(() => validateArray([1, 2, 3], 'param', { maxLength: 2 })).toThrow(
        'param должен содержать не более 2 элементов',
      );
      expect(validateArray([1, 2], 'param', { maxLength: 2 })).toEqual([1, 2]);
    });

    it('должен работать с пустым массивом', () => {
      expect(validateArray([], 'param')).toEqual([]);
    });
  });

  describe('validateEnum', () => {
    enum TestEnum {
      VALUE1 = 'value1',
      VALUE2 = 'value2',
      VALUE3 = 'value3',
    }

    it('должен возвращать валидное значение enum', () => {
      expect(validateEnum('value1', TestEnum, 'param')).toBe('value1');
      expect(validateEnum('value2', TestEnum, 'param')).toBe('value2');
    });

    it('должен выбрасывать ошибку для обязательного параметра', () => {
      expect(() => validateEnum(null, TestEnum, 'param')).toThrow('param обязателен');
      expect(() => validateEnum(undefined, TestEnum, 'param')).toThrow('param обязателен');
    });

    it('должен возвращать undefined для необязательного параметра', () => {
      expect(validateEnum(null, TestEnum, 'param', false)).toBeUndefined();
      expect(validateEnum(undefined, TestEnum, 'param', false)).toBeUndefined();
    });

    it('должен выбрасывать ошибку для невалидного значения', () => {
      expect(() => validateEnum('invalid', TestEnum, 'param')).toThrow(
        'param должен быть одним из: value1, value2, value3',
      );
    });

    it('должен работать с числовыми enum', () => {
      enum NumericEnum {
        FIRST = 1,
        SECOND = 2,
        THIRD = 3,
      }

      expect(validateEnum(1, NumericEnum, 'param')).toBe(1);
      expect(validateEnum(2, NumericEnum, 'param')).toBe(2);
      expect(() => validateEnum(4, NumericEnum, 'param')).toThrow(
        'param должен быть одним из: 1, 2, 3',
      );
    });
  });

  describe('createValidationResult', () => {
    it('должен создавать успешный результат валидации', () => {
      const result = createValidationResult(true, 'test data');
      expect(result).toEqual({
        isValid: true,
        data: 'test data',
      });
    });

    it('должен создавать неуспешный результат с ошибками', () => {
      const errors = ['Error 1', 'Error 2'];
      const result = createValidationResult(false, undefined, errors);
      expect(result).toEqual({
        isValid: false,
        errors,
      });
    });

    it('должен создавать результат с предупреждениями', () => {
      const warnings = ['Warning 1', 'Warning 2'];
      const result = createValidationResult(true, 'data', undefined, warnings);
      expect(result).toEqual({
        isValid: true,
        data: 'data',
        warnings,
      });
    });

    it('должен создавать результат со всеми полями', () => {
      const result = createValidationResult(false, 'data', ['error'], ['warning']);
      expect(result).toEqual({
        isValid: false,
        data: 'data',
        errors: ['error'],
        warnings: ['warning'],
      });
    });

    it('должен не включать пустые массивы', () => {
      const result = createValidationResult(true, 'data', [], []);
      expect(result).toEqual({
        isValid: true,
        data: 'data',
      });
    });
  });

  describe('validateWithErrorHandling', () => {
    it('должен возвращать успешный результат для валидной операции', async () => {
      const validator = jest.fn().mockResolvedValue('success');
      const result = await validateWithErrorHandling(validator, 'test operation');

      expect(result).toEqual({
        isValid: true,
        data: 'success',
      });
      expect(validator).toHaveBeenCalled();
    });

    it('должен возвращать успешный результат для синхронной операции', async () => {
      const validator = jest.fn().mockReturnValue('sync success');
      const result = await validateWithErrorHandling(validator, 'test operation');

      expect(result).toEqual({
        isValid: true,
        data: 'sync success',
      });
    });

    it('должен обрабатывать ошибки асинхронной операции', async () => {
      const validator = jest.fn().mockRejectedValue(new Error('Async error'));
      const result = await validateWithErrorHandling(validator, 'test operation');

      expect(result).toEqual({
        isValid: false,
        errors: ['Ошибка валидации test operation: Async error'],
      });
    });

    it('должен обрабатывать ошибки синхронной операции', async () => {
      const validator = jest.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });
      const result = await validateWithErrorHandling(validator, 'test operation');

      expect(result).toEqual({
        isValid: false,
        errors: ['Ошибка валидации test operation: Sync error'],
      });
    });

    it('должен обрабатывать строковые ошибки', async () => {
      const validator = jest.fn().mockRejectedValue('String error');
      const result = await validateWithErrorHandling(validator, 'test operation');

      expect(result).toEqual({
        isValid: false,
        errors: ['Ошибка валидации test operation: String error'],
      });
    });

    it('должен обрабатывать неизвестные ошибки', async () => {
      const validator = jest.fn().mockRejectedValue({ unknown: 'error' });
      const result = await validateWithErrorHandling(validator, 'test operation');

      expect(result).toEqual({
        isValid: false,
        errors: ['Ошибка валидации test operation: Неизвестная ошибка'],
      });
    });
  });

  describe('интеграционные тесты', () => {
    it('должен корректно работать полный цикл валидации', () => {
      // Проверяем цепочку валидации
      const requiredValue = validateRequired('test', 'param');
      const stringValue = validateString(requiredValue, 'param', { minLength: 2, maxLength: 10 });

      expect(stringValue).toBe('test');
    });

    it('должен корректно обрабатывать сложные сценарии валидации', async () => {
      const complexValidator = async () => {
        const str = validateString('test', 'string', { minLength: 3 });
        const num = validateNumber(42, 'number', { min: 0, max: 100 });
        const arr = validateArray([1, 2, 3], 'array', { minLength: 1 });

        return { str, num, arr };
      };

      const result = await validateWithErrorHandling(complexValidator, 'complex validation');

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({
        str: 'test',
        num: 42,
        arr: [1, 2, 3],
      });
    });

    it('должен корректно обрабатывать ошибки в цепочке валидации', async () => {
      const failingValidator = async () => {
        validateString('', 'string'); // Это должно выбросить ошибку
        return 'should not reach here';
      };

      const result = await validateWithErrorHandling(failingValidator, 'failing validation');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('string не может быть пустым');
    });
  });
});

// Определяем интерфейс ValidationResult если он не экспортируется

import {
  createNotFoundError,
  isEmptyString,
  getErrorMessage,
  validateRequired,
  validateString,
  validateNumber,
  InputValidator,
  ErrorPatternHandler,
} from '../../../src/common/abstractions/pattern-utils';

describe('PatternUtils', () => {
  describe('createNotFoundError', () => {
    it('должен создавать стандартную ошибку "не найден"', () => {
      const error = createNotFoundError('Персонаж', 123);
      expect(error.message).toBe('Персонаж с ID 123 не найден');
    });
  });

  describe('isEmptyString', () => {
    it('должен определять пустые строки', () => {
      expect(isEmptyString('')).toBe(true);
      expect(isEmptyString('   ')).toBe(true);
      expect(isEmptyString(null)).toBe(true);
      expect(isEmptyString(undefined)).toBe(true);
      expect(isEmptyString('test')).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('должен извлекать сообщение из Error', () => {
      const error = new Error('Тестовая ошибка');
      expect(getErrorMessage(error)).toBe('Тестовая ошибка');
    });

    it('должен возвращать строку как есть', () => {
      expect(getErrorMessage('Строковая ошибка')).toBe('Строковая ошибка');
    });

    it('должен возвращать дефолтное сообщение для неизвестных ошибок', () => {
      expect(getErrorMessage(123)).toBe('Неизвестная ошибка');
      expect(getErrorMessage({})).toBe('Неизвестная ошибка');
    });
  });

  describe('validateRequired', () => {
    it('должен проходить для валидных значений', () => {
      expect(() => validateRequired('test', 'param')).not.toThrow();
      expect(() => validateRequired(123, 'param')).not.toThrow();
      expect(() => validateRequired([], 'param')).not.toThrow();
    });

    it('должен выбрасывать ошибку для null/undefined', () => {
      expect(() => validateRequired(null, 'param')).toThrow('param обязателен');
      expect(() => validateRequired(undefined, 'param')).toThrow('param обязателен');
    });
  });

  describe('validateString', () => {
    it('должен проходить для валидных строк', () => {
      expect(() => validateString('test', 'param')).not.toThrow();
    });

    it('должен выбрасывать ошибку для обязательных пустых значений', () => {
      expect(() => validateString(null, 'param')).toThrow('param обязателен');
      expect(() => validateString('', 'param')).toThrow('param не может быть пустым');
    });

    it('должен выбрасывать ошибку для не-строк', () => {
      expect(() => validateString(123, 'param')).toThrow('param должен быть строкой');
    });

    it('должен пропускать необязательные пустые значения', () => {
      expect(() => validateString(null, 'param', false)).not.toThrow();
    });
  });

  describe('validateNumber', () => {
    it('должен проходить для валидных чисел', () => {
      expect(() => validateNumber(123, 'param')).not.toThrow();
      expect(() => validateNumber(0, 'param')).not.toThrow();
    });

    it('должен выбрасывать ошибку для обязательных пустых значений', () => {
      expect(() => validateNumber(null, 'param')).toThrow('param обязателен');
    });

    it('должен выбрасывать ошибку для не-чисел', () => {
      expect(() => validateNumber('123', 'param')).toThrow('param должен быть числом');
      expect(() => validateNumber(NaN, 'param')).toThrow('param должен быть числом');
    });
  });

  describe('InputValidator', () => {
    describe('validateId', () => {
      it('должен принимать валидные строковые ID', () => {
        expect(InputValidator.validateId('abc123')).toBe('abc123');
      });

      it('должен принимать валидные числовые ID', () => {
        expect(InputValidator.validateId(123)).toBe(123);
      });

      it('должен отклонять пустые строки', () => {
        expect(() => InputValidator.validateId('')).toThrow('ID не может быть пустым');
      });

      it('должен отклонять отрицательные числа', () => {
        expect(() => InputValidator.validateId(-1)).toThrow('ID должен быть положительным числом');
      });

      it('должен отклонять неподходящие типы', () => {
        expect(() => InputValidator.validateId({})).toThrow('ID должен быть строкой или числом');
      });
    });

    describe('validateUserInput', () => {
      it('должен принимать валидный ввод', () => {
        expect(InputValidator.validateUserInput('  test  ', 'поле')).toBe('test');
      });

      it('должен отклонять слишком длинный ввод', () => {
        const longInput = 'a'.repeat(1001);
        expect(() => InputValidator.validateUserInput(longInput, 'поле')).toThrow(
          'поле слишком длинный',
        );
      });
    });

    describe('validateArray', () => {
      it('должен принимать валидные массивы', () => {
        expect(InputValidator.validateArray([1, 2, 3], 'массив')).toEqual([1, 2, 3]);
      });

      it('должен отклонять не-массивы', () => {
        expect(() => InputValidator.validateArray('not array', 'массив')).toThrow(
          'массив должен быть массивом',
        );
      });

      it('должен возвращать пустой массив для null при required=false', () => {
        expect(InputValidator.validateArray(null, 'массив', false)).toEqual([]);
      });
    });
  });

  describe('ErrorPatternHandler', () => {
    describe('handleNotFound', () => {
      it('должен выбрасывать ошибку "не найден"', () => {
        expect(() => ErrorPatternHandler.handleNotFound('Персонаж', 123)).toThrow(
          'Персонаж с ID 123 не найден',
        );
      });
    });

    describe('handleValidationError', () => {
      it('должен выбрасывать ошибку валидации', () => {
        const originalError = new Error('Неверный формат');
        expect(() =>
          ErrorPatternHandler.handleValidationError(originalError, 'данных персонажа'),
        ).toThrow('Ошибка валидации данных персонажа: Неверный формат');
      });
    });

    describe('handleOperationError', () => {
      it('должен выбрасывать ошибку операции', () => {
        const originalError = new Error('База данных недоступна');
        expect(() => ErrorPatternHandler.handleOperationError(originalError, 'сохранении')).toThrow(
          'Ошибка при сохранении: База данных недоступна',
        );
      });
    });
  });
});

import { validatePort } from '../../../src/common/utils/port-validator.util';

describe('port-validator.util', () => {
  describe('validatePort', () => {
    it('должен возвращать валидный порт для корректного числа', () => {
      expect(validatePort('3000')).toBe(3000);
      expect(validatePort('8080')).toBe(8080);
      expect(validatePort('443')).toBe(443);
      expect(validatePort('80')).toBe(80);
      expect(validatePort('65535')).toBe(65535);
      expect(validatePort('1')).toBe(1);
    });

    it('должен выбрасывать ошибку для пустой строки', () => {
      expect(() => validatePort('')).toThrow('PORT environment variable is required');
      expect(() => validatePort('   ')).toThrow('PORT environment variable is required');
    });

    it('должен выбрасывать ошибку для undefined', () => {
      expect(() => validatePort(undefined)).toThrow('PORT environment variable is required');
    });

    it('должен выбрасывать ошибку для некорректных строк', () => {
      expect(() => validatePort('abc')).toThrow(
        'Некорректный PORT в переменных окружения: abc. PORT должен быть числом от 1 до 65535',
      );
      expect(() => validatePort('3000abc')).toThrow(
        'Некорректный PORT в переменных окружения: 3000abc. PORT должен быть числом от 1 до 65535',
      );
      expect(() => validatePort('abc3000')).toThrow(
        'Некорректный PORT в переменных окружения: abc3000. PORT должен быть числом от 1 до 65535',
      );
    });

    it('должен выбрасывать ошибку для отрицательных чисел', () => {
      expect(() => validatePort('-1')).toThrow(
        'Некорректный PORT в переменных окружения: -1. PORT должен быть числом от 1 до 65535',
      );
      expect(() => validatePort('-3000')).toThrow(
        'Некорректный PORT в переменных окружения: -3000. PORT должен быть числом от 1 до 65535',
      );
    });

    it('должен выбрасывать ошибку для нуля', () => {
      expect(() => validatePort('0')).toThrow(
        'Некорректный PORT в переменных окружения: 0. PORT должен быть числом от 1 до 65535',
      );
    });

    it('должен выбрасывать ошибку для слишком больших портов', () => {
      expect(() => validatePort('65536')).toThrow(
        'Некорректный PORT в переменных окружения: 65536. PORT должен быть числом от 1 до 65535',
      );
      expect(() => validatePort('100000')).toThrow(
        'Некорректный PORT в переменных окружения: 100000. PORT должен быть числом от 1 до 65535',
      );
    });

    it('должен выбрасывать ошибку для дробных чисел', () => {
      expect(() => validatePort('3000.5')).toThrow(
        'Некорректный PORT в переменных окружения: 3000.5. PORT должен быть числом от 1 до 65535',
      );
      expect(() => validatePort('3.14')).toThrow(
        'Некорректный PORT в переменных окружения: 3.14. PORT должен быть числом от 1 до 65535',
      );
    });

    it('должен выбрасывать ошибку для экспоненциальной записи', () => {
      expect(() => validatePort('3e3')).toThrow(
        'Некорректный PORT в переменных окружения: 3e3. PORT должен быть числом от 1 до 65535',
      );
      expect(() => validatePort('1e10')).toThrow(
        'Некорректный PORT в переменных окружения: 1e10. PORT должен быть числом от 1 до 65535',
      );
    });

    it('должен обрабатывать граничные значения', () => {
      // Минимальный валидный порт
      expect(validatePort('1')).toBe(1);

      // Максимальный валидный порт
      expect(validatePort('65535')).toBe(65535);

      // Граничные невалидные значения
      expect(() => validatePort('0')).toThrow();
      expect(() => validatePort('65536')).toThrow();
    });

    it('должен обрабатывать строки с пробелами', () => {
      expect(() => validatePort(' ')).toThrow('PORT environment variable is required');
      expect(() => validatePort('\t')).toThrow('PORT environment variable is required');
      expect(() => validatePort('\n')).toThrow('PORT environment variable is required');
      expect(() => validatePort('  \t\n  ')).toThrow('PORT environment variable is required');
    });

    it('должен обрабатывать стандартные порты', () => {
      // HTTP
      expect(validatePort('80')).toBe(80);

      // HTTPS
      expect(validatePort('443')).toBe(443);

      // SSH
      expect(validatePort('22')).toBe(22);

      // FTP
      expect(validatePort('21')).toBe(21);

      // SMTP
      expect(validatePort('25')).toBe(25);

      // DNS
      expect(validatePort('53')).toBe(53);

      // Обычные порты для разработки
      expect(validatePort('3000')).toBe(3000);
      expect(validatePort('8000')).toBe(8000);
      expect(validatePort('8080')).toBe(8080);
      expect(validatePort('9000')).toBe(9000);
    });

    it('должен обрабатывать порты с ведущими нулями', () => {
      expect(validatePort('0080')).toBe(80);
      expect(validatePort('03000')).toBe(3000);
      expect(validatePort('00443')).toBe(443);
    });

    it('должен выбрасывать правильные сообщения об ошибках', () => {
      // Проверяем структуру сообщения об ошибке
      try {
        validatePort('invalid');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Некорректный PORT в переменных окружения');
        expect((error as Error).message).toContain('invalid');
        expect((error as Error).message).toContain('PORT должен быть числом от 1 до 65535');
      }
    });

    describe('edge cases', () => {
      it('должен обрабатывать очень длинные строки', () => {
        const longString = '1'.repeat(1000);
        expect(() => validatePort(longString)).toThrow();
      });

      it('должен обрабатывать специальные символы', () => {
        expect(() => validatePort('3000!')).toThrow();
        expect(() => validatePort('@3000')).toThrow();
        expect(() => validatePort('3000#')).toThrow();
        expect(() => validatePort('30$00')).toThrow();
      });

      it('должен обрабатывать Unicode символы', () => {
        expect(() => validatePort('３０００')).toThrow(); // Полноширинные цифры
        expect(() => validatePort('3000①')).toThrow(); // Цифры в кружочках
      });

      it('должен обрабатывать бинарные и восьмеричные представления', () => {
        expect(() => validatePort('0b101110111000')).toThrow(); // Бинарное 3000
        expect(() => validatePort('0o5670')).toThrow(); // Восьмеричное 3000
        expect(() => validatePort('0x0BB8')).toThrow(); // Шестнадцатеричное 3000
      });
    });

    describe('производительность', () => {
      it('должен быстро обрабатывать множество запросов', () => {
        const start = Date.now();

        for (let i = 0; i < 1000; i++) {
          validatePort('3000');
        }

        const end = Date.now();
        const duration = end - start;

        // Должно выполниться быстро (менее 100ms для 1000 операций)
        expect(duration).toBeLessThan(100);
      });
    });

    describe('интеграционные тесты', () => {
      it('должен работать с реальными значениями environment variables', () => {
        // Симулируем реальные сценарии использования
        const commonPorts = ['80', '443', '3000', '8080', '5432', '6379', '27017'];

        commonPorts.forEach(port => {
          expect(() => validatePort(port)).not.toThrow();
          expect(validatePort(port)).toBe(parseInt(port, 10));
        });
      });

      it('должен корректно обрабатывать ошибки в цепочке валидации', () => {
        const validateConfig = (config: { port?: string }) => {
          if (!config.port) {
            throw new Error('Config must have port');
          }
          return validatePort(config.port);
        };

        expect(() => validateConfig({})).toThrow('Config must have port');
        expect(() => validateConfig({ port: 'invalid' })).toThrow('Некорректный PORT');
        expect(validateConfig({ port: '3000' })).toBe(3000);
      });
    });
  });
});

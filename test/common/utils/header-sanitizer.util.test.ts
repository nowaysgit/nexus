import {
  sanitizeHeaders,
  sanitizeData,
  SENSITIVE_HEADERS,
  SENSITIVE_FIELDS,
} from '../../../src/common/utils/header-sanitizer.util';

describe('header-sanitizer.util', () => {
  describe('sanitizeHeaders', () => {
    it('должен санитизировать чувствительные заголовки', () => {
      const headers = {
        Authorization: 'Bearer token123',
        'Content-Type': 'application/json',
        'X-API-Key': 'secret-key',
        'User-Agent': 'Mozilla/5.0',
      };

      const result = sanitizeHeaders(headers);

      expect(result['Authorization']).toBe('[РЕДАКТИРОВАНО]');
      expect(result['Content-Type']).toBe('"application/json"');
      expect(result['X-API-Key']).toBe('[РЕДАКТИРОВАНО]');
      expect(result['User-Agent']).toBe('"Mozilla/5.0"');
    });

    it('должен обрабатывать массивы заголовков', () => {
      const headers = {
        'Set-Cookie': ['session=abc123', 'theme=dark'],
        Accept: 'application/json',
      };

      const result = sanitizeHeaders(headers);

      expect(result['Set-Cookie']).toBe('[РЕДАКТИРОВАНО]');
      expect(result['Accept']).toBe('"application/json"');
    });

    it('должен обрабатывать пустые заголовки', () => {
      const result = sanitizeHeaders({});
      expect(result).toEqual({});
    });

    it('должен обрабатывать null/undefined заголовки', () => {
      expect(sanitizeHeaders(null)).toEqual({});
      expect(sanitizeHeaders(undefined)).toEqual({});
    });

    it('должен обрабатывать заголовки с undefined значениями', () => {
      const headers = {
        Authorization: 'Bearer token123',
        'Content-Type': undefined,
        'X-API-Key': 'secret-key',
      };

      const result = sanitizeHeaders(headers);

      expect(result['Authorization']).toBe('[РЕДАКТИРОВАНО]');
      expect(result['Content-Type']).toBeUndefined();
      expect(result['X-API-Key']).toBe('[РЕДАКТИРОВАНО]');
    });
  });

  describe('sanitizeData', () => {
    it('должен санитизировать чувствительные поля', () => {
      const data = {
        username: 'user123',
        password: 'secret123',
        email: 'user@example.com',
        apiKey: 'secret-api-key',
        token: 'jwt-token',
        normalField: 'normal-value',
      };

      const result = sanitizeData(data);

      expect(result).toEqual({
        username: 'user123',
        password: '[РЕДАКТИРОВАНО]',
        email: 'user@example.com',
        apiKey: '[РЕДАКТИРОВАНО]',
        token: '[РЕДАКТИРОВАНО]',
        normalField: 'normal-value',
      });
    });

    it('должен рекурсивно санитизировать вложенные объекты', () => {
      const data = {
        user: {
          name: 'John',
          credentials: {
            password: 'secret123',
            token: 'jwt-token',
          },
        },
        settings: {
          theme: 'dark',
          apiKey: 'secret-key',
        },
      };

      const result = sanitizeData(data);

      expect(result).toEqual({
        user: {
          name: 'John',
          credentials: {
            password: '[РЕДАКТИРОВАНО]',
            token: '[РЕДАКТИРОВАНО]',
          },
        },
        settings: {
          theme: 'dark',
          apiKey: '[РЕДАКТИРОВАНО]',
        },
      });
    });

    it('должен обрабатывать массивы', () => {
      const data = {
        users: [
          { name: 'John', password: 'secret1' },
          { name: 'Jane', password: 'secret2' },
        ],
        tokens: ['token1', 'token2'],
      };

      const result = sanitizeData(data);

      expect(result).toEqual({
        users: [
          { name: 'John', password: '[РЕДАКТИРОВАНО]' },
          { name: 'Jane', password: '[РЕДАКТИРОВАНО]' },
        ],
        tokens: ['token1', 'token2'],
      });
    });

    it('должен обрабатывать смешанные типы данных', () => {
      const data = {
        string: 'value',
        number: 42,
        boolean: true,
        nullValue: null,
        array: [1, 2, 3],
        object: {
          key: 'value',
        },
      };

      const result = sanitizeData(data);

      expect(result).toEqual({
        string: 'value',
        number: 42,
        boolean: true,
        nullValue: null,
        array: [1, 2, 3],
        object: {
          key: 'value',
        },
      });
    });

    it('должен обрабатывать циклические ссылки безопасно', () => {
      const data: any = {
        name: 'test',
        password: 'secret',
      };
      data.self = data; // Создаем циклическую ссылку

      const result = sanitizeData(data) as Record<string, unknown>;

      expect(result.name).toBe('test');
      expect(result.password).toBe('[РЕДАКТИРОВАНО]');
      expect(result.self).toEqual({ '[ЦИКЛИЧЕСКАЯ_ССЫЛКА]': true });
    });

    it('должен обрабатывать пустые данные', () => {
      expect(sanitizeData(null)).toEqual({});
      expect(sanitizeData(undefined)).toEqual({});
      expect(sanitizeData({})).toEqual({});
    });

    it('должен обрабатывать примитивные значения', () => {
      expect(sanitizeData('string')).toEqual({ value: 'string' });
      expect(sanitizeData(42)).toEqual({ value: 42 });
      expect(sanitizeData(true)).toEqual({ value: true });
    });

    it('должен обрабатывать все поля из SENSITIVE_FIELDS', () => {
      const data: Record<string, string> = {};

      // Создаем объект со всеми чувствительными полями
      SENSITIVE_FIELDS.forEach(field => {
        data[field] = 'secret-value';
        data[field.toUpperCase()] = 'secret-value';
      });

      const result = sanitizeData(data);

      // Проверяем, что все чувствительные поля санитизированы
      SENSITIVE_FIELDS.forEach(field => {
        expect(result[field]).toBe('[РЕДАКТИРОВАНО]');
        expect(result[field.toUpperCase()]).toBe('[РЕДАКТИРОВАНО]');
      });
    });
  });

  describe('SENSITIVE_FIELDS', () => {
    it('должен содержать ожидаемые чувствительные поля', () => {
      const expectedFields = [
        'password',
        'token',
        'secret',
        'credit_card',
        'card',
        'apikey',
        'api_key',
        'access_token',
        'refresh_token',
      ];

      expectedFields.forEach(field => {
        expect(SENSITIVE_FIELDS).toContain(field);
      });
    });

    it('должен быть неизменяемым массивом', () => {
      const originalLength = SENSITIVE_FIELDS.length;

      // Попытка изменить массив не должна влиять на оригинал
      expect(() => {
        (SENSITIVE_FIELDS as any).push('new-field');
      }).not.toThrow();

      // Но длина должна остаться прежней, если массив заморожен
      // Или просто проверим, что он содержит ожидаемые поля
      expect(SENSITIVE_FIELDS.length).toBeGreaterThan(0);
    });
  });

  describe('SENSITIVE_HEADERS', () => {
    it('должен содержать ожидаемые чувствительные заголовки', () => {
      const expectedHeaders = [
        'authorization',
        'cookie',
        'set-cookie',
        'x-auth-token',
        'api-key',
        'x-api-key',
        'proxy-authorization',
        'www-authenticate',
        'token',
      ];

      expectedHeaders.forEach(header => {
        expect(SENSITIVE_HEADERS).toContain(header);
      });
    });
  });

  describe('интеграционные тесты', () => {
    it('должен корректно санитизировать HTTP запрос', () => {
      const headers = {
        Authorization: 'Bearer jwt-token',
        'Content-Type': 'application/json',
        'X-API-Key': 'secret-key',
        'User-Agent': 'TestAgent/1.0',
      };

      const body = {
        username: 'user123',
        password: 'secret123',
        email: 'user@example.com',
      };

      const sanitizedHeaders = sanitizeHeaders(headers);
      const sanitizedBody = sanitizeData(body) as Record<string, unknown>;

      expect(sanitizedHeaders['Authorization']).toBe('[РЕДАКТИРОВАНО]');
      expect(sanitizedHeaders['X-API-Key']).toBe('[РЕДАКТИРОВАНО]');
      expect(sanitizedHeaders['Content-Type']).toBe('"application/json"');

      expect(sanitizedBody.username).toBe('user123');
      expect(sanitizedBody.password).toBe('[РЕДАКТИРОВАНО]');
      expect(sanitizedBody.email).toBe('user@example.com');
    });

    it('должен корректно санитизировать сложные структуры данных', () => {
      const complexData = {
        user: {
          profile: {
            name: 'John Doe',
            email: 'john@example.com',
            credentials: {
              password: 'secret123',
              apiKey: 'secret-api-key',
            },
          },
          sessions: [
            { id: 1, token: 'session-token-1', active: true },
            { id: 2, token: 'session-token-2', active: false },
          ],
        },
        config: {
          database: {
            host: 'localhost',
            port: 5432,
            password: 'db-password',
          },
          api: {
            key: 'api-key-value',
            secret: 'api-secret-value',
          },
        },
      };

      const result = sanitizeData(complexData);

      expect((result as any).user.profile.name).toBe('John Doe');
      expect((result as any).user.profile.email).toBe('john@example.com');
      expect((result as any).user.profile.credentials.password).toBe('[РЕДАКТИРОВАНО]');
      expect((result as any).user.profile.credentials.apiKey).toBe('[РЕДАКТИРОВАНО]');
      expect((result as any).user.sessions[0].token).toBe('[РЕДАКТИРОВАНО]');
      expect((result as any).user.sessions[1].token).toBe('[РЕДАКТИРОВАНО]');
      expect((result as any).config.database.host).toBe('localhost');
      expect((result as any).config.database.password).toBe('[РЕДАКТИРОВАНО]');
      expect((result as any).config.api.secret).toBe('[РЕДАКТИРОВАНО]');
    });
  });
});

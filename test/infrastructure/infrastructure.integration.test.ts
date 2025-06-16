import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { ConfigModule } from '@nestjs/config';
import { ApiKeyService } from '../../src/infrastructure/api-key.service';
import { EncryptionService } from '../../src/infrastructure/encryption.service';
import { InfrastructureModule } from '../../src/infrastructure/infrastructure.module';
import { LoggingModule } from '../../src/logging/logging.module';
import { Request } from 'express';

// Интерфейс для мока Request объекта
interface MockRequestOptions {
  headers?: Record<string, string | string[]>;
  query?: Record<string, string | string[]>;
  path?: string;
  ip?: string;
  connection?: { remoteAddress: string };
}

// Интерфейс для комплексных данных в тесте
interface ComplexTestData {
  id: number;
  name: string;
  email: string;
  metadata: {
    lastLogin: string;
    preferences: {
      theme: string;
      notifications: boolean;
    };
  };
}

// Мок Request объекта для тестов
function createMockRequest(options: MockRequestOptions = {}): Request {
  const mockRequest = {
    headers: options.headers || {},
    query: options.query || {},
    path: options.path || '/api/test',
    ip: options.ip || '127.0.0.1',
    connection: options.connection || { remoteAddress: '127.0.0.1' },
  };

  return mockRequest as unknown as Request;
}

createTestSuite('Infrastructure Integration Tests', () => {
  createTest(
    {
      name: 'должен создать экземпляры сервисов инфраструктуры',
      configType: TestConfigType.BASIC,
      imports: [InfrastructureModule, LoggingModule, ConfigModule.forRoot({ isGlobal: true })],
      requiresDatabase: false,
    },
    async ({ get }) => {
      const apiKeyService = get<ApiKeyService>(ApiKeyService);
      const encryptionService = get<EncryptionService>(EncryptionService);

      expect(apiKeyService).toBeDefined();
      expect(encryptionService).toBeDefined();
    },
  );

  createTest(
    {
      name: 'должен шифровать и расшифровывать данные',
      configType: TestConfigType.BASIC,
      imports: [InfrastructureModule, LoggingModule, ConfigModule.forRoot({ isGlobal: true })],
      requiresDatabase: false,
    },
    async ({ get }) => {
      const encryptionService = get<EncryptionService>(EncryptionService);
      const testData = 'Тестовые данные для шифрования';

      // Шифруем данные
      const encrypted = await encryptionService.encrypt(testData);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toEqual(testData);

      // Расшифровываем данные
      const decrypted = await encryptionService.decrypt(encrypted);
      expect(decrypted).toEqual(testData);
    },
  );

  createTest(
    {
      name: 'должен создавать хеши данных',
      configType: TestConfigType.BASIC,
      imports: [InfrastructureModule, LoggingModule, ConfigModule.forRoot({ isGlobal: true })],
      requiresDatabase: false,
    },
    async ({ get }) => {
      const encryptionService = get<EncryptionService>(EncryptionService);
      const testData = 'Тестовые данные для хеширования';

      // Создаем хеш
      const hash = await encryptionService.hash(testData);
      expect(hash).toBeDefined();
      expect(hash).not.toEqual(testData);

      // Проверяем хеш с помощью сравнения
      const hash2 = await encryptionService.hash(testData);
      expect(hash).toEqual(hash2);

      // Проверяем хеш для других данных
      const hashOther = await encryptionService.hash('Другие данные');
      expect(hash).not.toEqual(hashOther);
    },
  );

  createTest(
    {
      name: 'должен проверять является ли данные зашифрованными',
      configType: TestConfigType.BASIC,
      imports: [InfrastructureModule, LoggingModule, ConfigModule.forRoot({ isGlobal: true })],
      requiresDatabase: false,
    },
    async ({ get }) => {
      const encryptionService = get<EncryptionService>(EncryptionService);
      const testData = 'Тестовые данные';

      // Шифруем данные
      const encrypted = await encryptionService.encrypt(testData);

      // Проверяем зашифрованные данные
      const isEncrypted = await encryptionService.isEncrypted(encrypted);
      expect(isEncrypted).toBe(true);

      // Проверяем незашифрованные данные
      const isPlainTextEncrypted = await encryptionService.isEncrypted(testData);
      expect(isPlainTextEncrypted).toBe(false);
    },
  );

  createTest(
    {
      name: 'должен генерировать ключи шифрования',
      configType: TestConfigType.BASIC,
      imports: [InfrastructureModule, LoggingModule, ConfigModule.forRoot({ isGlobal: true })],
      requiresDatabase: false,
    },
    async ({ get }) => {
      const encryptionService = get<EncryptionService>(EncryptionService);

      // Генерируем ключ
      const key = await encryptionService.generateKey();
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(10);
    },
  );

  createTest(
    {
      name: 'должен извлекать API ключи из запросов',
      configType: TestConfigType.BASIC,
      imports: [
        InfrastructureModule,
        LoggingModule,
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              api: {
                key: 'test-api-key',
              },
            }),
          ],
        }),
      ],
      requiresDatabase: false,
    },
    async ({ get }) => {
      const apiKeyService = get<ApiKeyService>(ApiKeyService);

      // Запрос с ключом в заголовке
      const headerRequest = createMockRequest({
        headers: { 'x-api-key': 'test-api-key' },
      });
      expect(apiKeyService.extractApiKey(headerRequest)).toBe('test-api-key');

      // Запрос с ключом в query параметрах
      const queryRequest = createMockRequest({
        query: { api_key: 'test-api-key' },
      });
      expect(apiKeyService.extractApiKey(queryRequest)).toBe('test-api-key');

      // Запрос без ключа
      const noKeyRequest = createMockRequest();
      expect(apiKeyService.extractApiKey(noKeyRequest)).toBeUndefined();
    },
  );

  createTest(
    {
      name: 'должен разрешать локальные запросы без ключа',
      configType: TestConfigType.BASIC,
      imports: [
        InfrastructureModule,
        LoggingModule,
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              api: {
                key: 'test-api-key',
              },
            }),
          ],
        }),
      ],
      requiresDatabase: false,
    },
    async ({ get }) => {
      const apiKeyService = get<ApiKeyService>(ApiKeyService);

      // Локальный запрос без ключа
      const localRequest = createMockRequest({
        ip: '127.0.0.1',
      });

      const isValid = apiKeyService.validateClientApiKey(localRequest);
      expect(isValid).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен работать с комплексными сценариями шифрования',
      configType: TestConfigType.BASIC,
      imports: [InfrastructureModule, LoggingModule, ConfigModule.forRoot({ isGlobal: true })],
      requiresDatabase: false,
    },
    async ({ get }) => {
      const encryptionService = get<EncryptionService>(EncryptionService);

      // Комплексный объект для шифрования
      const complexData: ComplexTestData = {
        id: 123,
        name: 'Тестовый пользователь',
        email: 'test@example.com',
        metadata: {
          lastLogin: new Date().toISOString(),
          preferences: {
            theme: 'dark',
            notifications: true,
          },
        },
      };

      // Шифруем объект
      const jsonString = JSON.stringify(complexData);
      const encrypted = await encryptionService.encrypt(jsonString);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toEqual(jsonString);

      // Расшифровываем объект
      const decrypted = await encryptionService.decrypt(encrypted);
      const parsedData = JSON.parse(decrypted) as ComplexTestData;

      // Проверяем, что объект восстановлен правильно
      expect(parsedData).toEqual(complexData);
    },
  );

  createTest(
    {
      name: 'должен разрешать внешние запросы с правильным ключом',
      configType: TestConfigType.BASIC,
      imports: [
        InfrastructureModule,
        LoggingModule,
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              api: {
                key: 'test-api-key',
              },
            }),
          ],
        }),
      ],
      requiresDatabase: false,
    },
    async ({ get }) => {
      const apiKeyService = get<ApiKeyService>(ApiKeyService);

      // Внешний запрос с правильным ключом
      const validRequest = createMockRequest({
        ip: '8.8.8.8',
        headers: { 'x-api-key': 'test-api-key' },
      });

      const isValid = apiKeyService.validateClientApiKey(validRequest);
      expect(isValid).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен блокировать внешние запросы с неправильным ключом',
      configType: TestConfigType.BASIC,
      imports: [
        InfrastructureModule,
        LoggingModule,
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              api: {
                key: 'test-api-key',
              },
            }),
          ],
        }),
      ],
      requiresDatabase: false,
    },
    async ({ get }) => {
      const apiKeyService = get<ApiKeyService>(ApiKeyService);

      // Запрос с неправильным ключом
      const invalidRequest = createMockRequest({
        ip: '8.8.8.8',
        headers: { 'x-api-key': 'wrong-key' },
      });
      const isValid = apiKeyService.validateClientApiKey(invalidRequest);
      expect(isValid).toBe(false);
    },
  );

  createTest(
    {
      name: 'должен блокировать внешние запросы без ключа',
      configType: TestConfigType.BASIC,
      imports: [
        InfrastructureModule,
        LoggingModule,
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              api: {
                key: 'test-api-key',
              },
            }),
          ],
        }),
      ],
      requiresDatabase: false,
    },
    async ({ get }) => {
      const apiKeyService = get<ApiKeyService>(ApiKeyService);

      // Внешний запрос без ключа
      const noKeyRequest = createMockRequest({
        ip: '8.8.8.8',
      });
      const isValid = apiKeyService.validateClientApiKey(noKeyRequest);
      expect(isValid).toBe(false);
    },
  );
});

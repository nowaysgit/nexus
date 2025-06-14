import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { ConfigModule } from '@nestjs/config';
import { ApiKeyService } from '../../src/infrastructure/api-key.service';
import { EncryptionService } from '../../src/infrastructure/encryption.service';
import { InfrastructureModule } from '../../src/infrastructure/infrastructure.module';
import { LoggingModule } from '../../src/logging/logging.module';

// Мок Request объекта для тестов
const createMockRequest = (overrides: any = {}): any => ({
  headers: {},
  query: {},
  path: '/api/test',
  ip: '127.0.0.1',
  connection: { remoteAddress: '127.0.0.1' },
  ...overrides,
});
createTestSuite('Infrastructure Integration Tests', () => {
  createTest(
    {
      name: 'должен создать экземпляры сервисов инфраструктуры',
      configType: TestConfigType.BASIC,
      imports: [InfrastructureModule, LoggingModule, ConfigModule.forRoot({ isGlobal: true })],
      requiresDatabase: false,
    },
    async ({ get }) => {
      const encryptionService = get<EncryptionService>(EncryptionService);
      const apiKeyService = get<ApiKeyService>(ApiKeyService);

      expect(encryptionService).toBeDefined();
      expect(encryptionService).toBeInstanceOf(EncryptionService);
      expect(apiKeyService).toBeDefined();
      expect(apiKeyService).toBeInstanceOf(ApiKeyService);
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

      const originalData = 'Секретные данные для тестирования';

      // Шифруем данные
      const encrypted = await encryptionService.encrypt(originalData);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(originalData);
      expect(encrypted.length).toBeGreaterThan(0);

      // Расшифровываем данные
      const decrypted = await encryptionService.decrypt(encrypted);

      expect(decrypted).toBeDefined();
      expect(decrypted).toBe(originalData);
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

      const data = 'Данные для хеширования';

      // Создаем хеш
      const hash1 = await encryptionService.hash(data);
      const hash2 = await encryptionService.hash(data);

      expect(hash1).toBeDefined();
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);

      // Хеши одинаковых данных должны быть одинаковыми
      expect(hash1).toBe(hash2);

      // Хеш разных данных должен отличаться
      const differentHash = await encryptionService.hash('Другие данные');
      expect(differentHash).not.toBe(hash1);
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

      const plainText = 'Обычный текст';
      const encrypted = await encryptionService.encrypt(plainText);

      // Проверяем зашифрованные данные
      const isEncryptedTrue = await encryptionService.isEncrypted(encrypted);
      expect(isEncryptedTrue).toBe(true);

      // Проверяем обычный текст
      const isEncryptedFalse = await encryptionService.isEncrypted(plainText);
      expect(isEncryptedFalse).toBe(false);
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
      const key1 = await encryptionService.generateKey();
      const key2 = await encryptionService.generateKey();

      expect(key1).toBeDefined();
      expect(typeof key1).toBe('string');
      expect(key1.length).toBe(64); // 32 байта = 64 hex символа

      expect(key2).toBeDefined();
      expect(typeof key2).toBe('string');
      expect(key2.length).toBe(64);

      // Ключи должны быть разными
      expect(key1).not.toBe(key2);

      // Ключи должны содержать только hex символы
      expect(/^[0-9a-f]+$/.test(key1)).toBe(true);
      expect(/^[0-9a-f]+$/.test(key2)).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен извлекать API ключи из запросов',
      configType: TestConfigType.BASIC,
      imports: [InfrastructureModule, LoggingModule, ConfigModule.forRoot({ isGlobal: true })],
      requiresDatabase: false,
    },
    async ({ get }) => {
      const apiKeyService = get<ApiKeyService>(ApiKeyService);

      // Тест извлечения из заголовка
      const headerRequest = createMockRequest({
        headers: { 'x-api-key': 'header-key' },
      });
      const headerKey = apiKeyService.extractApiKey(headerRequest);
      expect(headerKey).toBe('header-key');

      // Тест извлечения из query
      const queryRequest = createMockRequest({
        query: { apiKey: 'query-key' },
      });
      const queryKey = apiKeyService.extractApiKey(queryRequest);
      expect(queryKey).toBe('query-key');

      // Тест когда ключ отсутствует
      const noKeyRequest = createMockRequest();
      const noKey = apiKeyService.extractApiKey(noKeyRequest);
      expect(noKey).toBeUndefined();
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
          load: [() => ({})], // Без настроенных ключей
        }),
      ],
      requiresDatabase: false,
    },
    async ({ get }) => {
      const apiKeyService = get<ApiKeyService>(ApiKeyService);

      // Локальный запрос без ключа
      const localRequest = createMockRequest({
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
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
      const data = {
        user: 'testUser',
        permissions: ['read', 'write'],
        timestamp: Date.now(),
      };
      const jsonData = JSON.stringify(data);

      const encrypted = await encryptionService.encrypt(jsonData);
      const decrypted = await encryptionService.decrypt(encrypted);
      const decryptedData = JSON.parse(decrypted);

      expect(decryptedData).toEqual(data);
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
              security: {
                apiKey: 'test-api-key',
              },
            }),
          ],
        }),
      ],
      requiresDatabase: false,
    },
    async ({ get }) => {
      const apiKeyService = get<ApiKeyService>(ApiKeyService);

      // Запрос с правильным ключом
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
              security: {
                apiKey: 'test-api-key',
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
              security: {
                apiKey: 'test-api-key',
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

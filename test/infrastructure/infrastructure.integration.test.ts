import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { ConfigModule } from '@nestjs/config';
import { ApiKeyService } from '../../src/infrastructure/api-key.service';
import { EncryptionService } from '../../src/infrastructure/encryption.service';
import { InfrastructureModule } from '../../src/infrastructure/infrastructure.module';
import { LoggingModule } from '../../src/logging/logging.module';
import { Request } from 'express';

// MockRequestOptions удален - больше не используется

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

// Мок Request объекта удален - больше не используется в этом файле

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

  // API Key тесты перенесены в test/infrastructure/api-key.service.test.ts

  // Локальные запросы API Key тесты перенесены в unit тесты

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

  // Все остальные API Key тесты перенесены в unit тесты
});

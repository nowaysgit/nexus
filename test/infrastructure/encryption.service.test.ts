import { EncryptionService } from '../../src/infrastructure/encryption.service';
import { ConfigService } from '@nestjs/config';
import { createTest, createTestSuite, TestConfigType } from '../../lib/tester';
import { LogService } from '../../src/logging/log.service';

createTestSuite('EncryptionService Tests', () => {
  const mockLogService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn().mockReturnThis(),
  };

  const mockConfigService = (key?: string) => ({
    get: jest.fn().mockReturnValue(key),
  });

  createTest(
    {
      name: 'should be defined',
      configType: TestConfigType.BASIC,
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: mockConfigService('some_encryption_key_in_hex_format_32_bytes'),
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    },
    async context => {
      const service = context.get<EncryptionService>(EncryptionService);
      expect(service).toBeDefined();
    },
  );

  createTest(
    {
      name: 'should encrypt and decrypt data successfully',
      configType: TestConfigType.BASIC,
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: mockConfigService('a'.repeat(64)), // 32 bytes in hex
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    },
    async context => {
      const service = context.get<EncryptionService>(EncryptionService);
      const originalText = 'this is a secret message';
      const encrypted = await service.encrypt(originalText);
      const decrypted = await service.decrypt(encrypted);

      expect(encrypted).not.toBe(originalText);
      expect(decrypted).toBe(originalText);
    },
  );

  createTest(
    {
      name: 'should throw error for invalid encrypted data format',
      configType: TestConfigType.BASIC,
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: mockConfigService('a'.repeat(64)),
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    },
    async context => {
      const service = context.get<EncryptionService>(EncryptionService);
      const invalidData = 'invalid-data';
      await expect(service.decrypt(invalidData)).rejects.toThrow(
        'Неверный формат зашифрованных данных',
      );
    },
  );

  createTest(
    {
      name: 'should correctly identify encrypted data',
      configType: TestConfigType.BASIC,
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: mockConfigService('a'.repeat(64)),
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    },
    async context => {
      const service = context.get<EncryptionService>(EncryptionService);
      const originalText = 'another secret';
      const encrypted = await service.encrypt(originalText);

      await expect(service.isEncrypted(encrypted)).resolves.toBe(true);
      await expect(service.isEncrypted(originalText)).resolves.toBe(false);
    },
  );

  createTest(
    {
      name: 'should hash data consistently',
      configType: TestConfigType.BASIC,
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: mockConfigService(),
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    },
    async context => {
      const service = context.get<EncryptionService>(EncryptionService);
      const data = 'data to be hashed';
      const hash1 = await service.hash(data);
      const hash2 = await service.hash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    },
  );

  createTest(
    {
      name: 'should generate a new key',
      configType: TestConfigType.BASIC,
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: mockConfigService(),
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    },
    async context => {
      const service = context.get<EncryptionService>(EncryptionService);
      const key = await service.generateKey();
      expect(key).toBeDefined();
      expect(key).toHaveLength(64); // 32 bytes in hex
    },
  );
});

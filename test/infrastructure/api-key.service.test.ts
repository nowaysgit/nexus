import { ApiKeyService } from '../../src/infrastructure/api-key.service';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { createTest, createTestSuite, TestConfigType } from '../../lib/tester';
import { LogService } from '../../src/logging/log.service';

createTestSuite('ApiKeyService Tests', () => {
  const createMockRequest = (
    path: string = '/api/test',
    headers: Record<string, string | string[]> = {},
    query: Record<string, string> = {},
    ip: string = '192.168.1.1',
  ): Partial<Request> => ({
    path,
    headers,
    query,
    ip,
    connection: { remoteAddress: ip } as any,
  });

  const mockLogService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const testCases = [
    {
      name: 'должен извлекать API ключ из заголовка X-API-KEY',
      request: createMockRequest('/api/test', { 'x-api-key': 'test-key-123' }),
      expected: 'test-key-123',
    },
    {
      name: 'должен извлекать API ключ из query параметра',
      request: createMockRequest('/api/test', {}, { apiKey: 'query-key-456' }),
      expected: 'query-key-456',
    },
    {
      name: 'должен приоритизировать заголовок над query параметром',
      request: createMockRequest(
        '/api/test',
        { 'x-api-key': 'header-key' },
        { apiKey: 'query-key' },
      ),
      expected: 'header-key',
    },
    {
      name: 'должен возвращать undefined если ключ не найден',
      request: createMockRequest('/api/test'),
      expected: undefined,
    },
    {
      name: 'должен обрабатывать массив заголовков',
      request: createMockRequest('/api/test', { 'x-api-key': ['first-key', 'second-key'] }),
      expected: 'first-key',
    },
  ];

  for (const tc of testCases) {
    createTest(
      {
        name: tc.name,
        configType: TestConfigType.BASIC,
        providers: [
          ApiKeyService,
          ConfigService,
          {
            provide: LogService,
            useValue: mockLogService,
          },
        ],
      },
      async context => {
        const service = context.get<ApiKeyService>(ApiKeyService);
        const extractedKey = service.extractApiKey(tc.request as Request);
        expect(extractedKey).toBe(tc.expected);
      },
    );
  }

  createTest(
    {
      name: 'должен разрешать локальные запросы без ключа',
      configType: TestConfigType.BASIC,
      providers: [
        ApiKeyService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'admin.apiKey') return '';
              if (key === 'api.key') return '';
              return null;
            }),
          },
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    },
    async context => {
      const service = context.get<ApiKeyService>(ApiKeyService);
      const localRequest = createMockRequest('/api/test', {}, {}, '127.0.0.1');
      const isValid = service.validateApiKey(localRequest as Request);
      expect(isValid).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен отклонять внешние запросы без ключа',
      configType: TestConfigType.BASIC,
      providers: [
        ApiKeyService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'admin.apiKey') return '';
              if (key === 'api.key') return '';
              return null;
            }),
          },
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    },
    async context => {
      const service = context.get<ApiKeyService>(ApiKeyService);
      const externalRequest = createMockRequest('/api/test', {}, {}, '192.168.1.100');
      const isValid = service.validateApiKey(externalRequest as Request);
      expect(isValid).toBe(false);
    },
  );

  createTest(
    {
      name: 'should be defined',
      configType: TestConfigType.BASIC,
      providers: [
        {
          provide: ApiKeyService,
          useValue: {},
        },
      ],
    },
    async context => {
      const service = context.get<ApiKeyService>(ApiKeyService);
      expect(service).toBeDefined();
    },
  );
});

import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { LogService } from '../../src/logging/log.service';
import { RollbarService } from '../../src/logging/rollbar.service';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

createTestSuite('LogService', () => {
  const mockWinston = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  const mockRollbarService = {
    warn: jest.fn(),
    error: jest.fn(),
    critical: jest.fn(),
    enabled: true,
  };

  const mockConfigService = {
    get: (key: string, defaultValue?: any): any => {
      const config: Record<string, any> = {
        'logging.rollbar.enabled': false,
        'logging.logger.level': 'info',
        'logging.rollbar': {
          enabled: false,
          accessToken: 'test-token',
          environment: 'test',
          captureUncaught: false,
          captureUnhandledRejections: false,
        },
      };
      return config[key] || defaultValue;
    },
  };

  const providers = [
    LogService,
    {
      provide: RollbarService,
      useValue: mockRollbarService,
    },
    {
      provide: ConfigService,
      useValue: mockConfigService,
    },
    {
      provide: WINSTON_MODULE_PROVIDER,
      useValue: mockWinston,
    },
  ];

  createTest(
    {
      name: 'should create logger instance',
      configType: TestConfigType.BASIC,
      providers,
    },
    async context => {
      const logService = context.get(LogService);
      expect(logService).toBeDefined();
    },
  );

  createTest(
    {
      name: 'should log info message',
      configType: TestConfigType.BASIC,
      providers,
    },
    async context => {
      jest.clearAllMocks();
      const logService = context.get(LogService);
      logService.info('Test message', { key: 'value' });
      expect(mockWinston.info).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should set and get context',
      configType: TestConfigType.BASIC,
      providers,
    },
    async context => {
      const logService = context.get(LogService);
      const contextLogger = logService.setContext('TestContext');
      expect(contextLogger.getContext()).toBe('TestContext');
    },
  );

  createTest(
    {
      name: 'should create logger for context',
      configType: TestConfigType.BASIC,
      providers,
    },
    async context => {
      const logService = context.get(LogService);
      const contextLogger = logService.forContext('NewContext');
      expect(contextLogger.getContext()).toBe('NewContext');
      expect(contextLogger).toBeInstanceOf(LogService);
    },
  );

  createTest(
    {
      name: 'should log error with Error object',
      configType: TestConfigType.BASIC,
      providers,
    },
    async context => {
      jest.clearAllMocks();
      const logService = context.get(LogService);
      const testError = new Error('Test error');
      logService.error(testError);
      expect(mockWinston.error).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should handle critical errors and notify Rollbar',
      configType: TestConfigType.BASIC,
      providers: [
        LogService,
        { provide: RollbarService, useValue: mockRollbarService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'logging.rollbar.enabled') return true;
              if (key === 'logging.rollbar') return { enabled: true, accessToken: 'fake' };
              return mockConfigService.get(key);
            },
          },
        },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockWinston },
      ],
    },
    async context => {
      jest.clearAllMocks();
      const logService = context.get(LogService);
      const criticalError = new Error('Critical failure');
      logService.critical(criticalError, { userId: '123' });
      expect(mockWinston.error).toHaveBeenCalled();
      expect(mockRollbarService.critical).toHaveBeenCalled();
    },
  );
});

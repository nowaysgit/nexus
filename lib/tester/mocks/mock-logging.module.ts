import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockLogService } from './log.service.mock';
import { LogService } from '../../../src/logging/log.service';
import { RollbarService } from '../../../src/logging/rollbar.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Global()
@Module({})
export class MockLoggingModule {
  static forRoot(): DynamicModule {
    return {
      module: MockLoggingModule,
      providers: [
        {
          provide: LogService,
          useClass: MockLogService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              enabled: false,
              accessToken: 'test-token',
              environment: 'test',
              captureUncaught: true,
              captureUnhandledRejections: true,
            }),
          },
        },
        {
          provide: RollbarService,
          useValue: {
            info: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            critical: jest.fn(),
            onModuleInit: jest.fn(),
          },
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
          },
        },
      ],
      exports: [LogService, ConfigService, RollbarService, WINSTON_MODULE_PROVIDER],
    };
  }
}

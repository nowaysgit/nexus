import { DynamicModule, Global, Module } from '@nestjs/common';
import { MockLogService } from './log.service.mock';
import { LogService } from '../../../src/logging/log.service';
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
      exports: [LogService, WINSTON_MODULE_PROVIDER],
    };
  }
}

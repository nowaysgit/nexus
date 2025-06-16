import { DynamicModule, Global, Module } from '@nestjs/common';
import { EncryptionService } from '../../../src/infrastructure/encryption.service';
import { ApiKeyService } from '../../../src/infrastructure/api-key.service';
import { MockEncryptionService, MockApiKeyService } from './index';

@Global()
@Module({})
export class MockInfrastructureModule {
  static forRoot(): DynamicModule {
    return {
      module: MockInfrastructureModule,
      providers: [
        { provide: EncryptionService, useClass: MockEncryptionService },
        { provide: ApiKeyService, useClass: MockApiKeyService },
      ],
      exports: [EncryptionService, ApiKeyService],
    };
  }
}

export { MockLogService } from './log.service.mock';
export { MockRollbarService } from './rollbar.service.mock';
export { mockConfigService, ConfigServiceProvider } from './config.service.mock';
export { MockEventEmitter } from './event-emitter.mock';
export { mockLlamaProviderService } from './llama-provider.mock';
export { MockMemoryService } from './memory-service.mock';
export { MockNeedsService } from './needs-service.mock';
export { MockUserService } from './user-service.mock';
export { createMockTelegramService, mockTelegramService } from './telegram-service.mock';
export { 
    MockTelegramModule,
    mockTelegramCoreService,
    mockAccessControlService,
    mockCharacterCreationService,
    mockMessageService,
    mockMessageFormatterService,
    mockKeyboardFormatterService,
    mockTelegramUserService,
    mockTelegramInitializationService,
} from './mock-telegram.module';
export { MockLLMProviderManagerService, MockEmotionalStateService } from './jest.mocks';
export { TelegrafTokenProvider, mockTelegraf } from './telegraf-token.provider';
export { MockProviderFactory } from './mock-provider';
export { MockInfrastructureModule } from './mock-infrastructure.module';

export class MockApiKeyService {
  extractApiKey(req: any): string | undefined {
    return req.headers?.['x-api-key'] || req.query?.apiKey;
  }
  validateClientApiKey(req: any): boolean {
    const key = this.extractApiKey(req);
    return !key || key === 'header-key' || key === 'query-key' || key === 'valid-key';
  }
}

export class MockEncryptionService {
  async encrypt(data: string): Promise<string> {
    return Buffer.from(data, 'utf8').toString('base64');
  }
  async decrypt(encrypted: string): Promise<string> {
    return Buffer.from(encrypted, 'base64').toString('utf8');
  }
  async hash(data: string): Promise<string> {
    /* eslint-disable import/no-commonjs, @typescript-eslint/no-var-requires */
    const hash = require('crypto').createHash('sha256').update(data).digest('hex');
    /* eslint-enable */
    return hash;
  }
  async isEncrypted(data: string): Promise<boolean> {
    try {
      const decoded = Buffer.from(data, 'base64').toString('utf8');
      return !!decoded;
    } catch {
      return false;
    }
  }
  async generateKey(): Promise<string> {
    /* eslint-disable import/no-commonjs, @typescript-eslint/no-var-requires */
    return require('crypto').randomBytes(32).toString('hex');
    /* eslint-enable */
  }
}

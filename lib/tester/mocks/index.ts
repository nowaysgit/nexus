/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-require-imports */
export * from './config.service.mock';
export * from './event-emitter.mock';
export * from './llm.service.mock';
export * from './log.service.mock';
export * from './rollbar.service.mock';
export * from './telegraf-token.provider';
export * from './user-service.mock';
export * from './mock-telegram.module';
export * from './mock-monitoring.module';

export { MockLogService } from './log.service.mock';
export { MockRollbarService } from './rollbar.service.mock';
export { MockLLMService } from './llm.service.mock';
export { MockUserService } from './user-service.mock';
export { MockEventEmitter } from './event-emitter.mock';
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
export { MockProviderFactory } from './mock-provider';
export { MockInfrastructureModule } from './mock-infrastructure.module';
export { MockNeedsService } from './needs-service.mock';
export { MockTypeOrmModule } from './mock-typeorm.module';
export { TelegrafTokenMockModule as MockTelegrafTokenModule } from './telegraf-token.module';

export class MockApiKeyService {
  private readonly validApiKeys: string[];

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
    const hash = require('crypto').createHash('sha256').update(data).digest('hex');

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
    return require('crypto').randomBytes(32).toString('hex');
  }
}

export const MockActionExecutorService = {
  determineAndPerformAction: jest.fn(),
  isPerformingAction: jest.fn(),
  getCurrentAction: jest.fn(),
  interruptAction: jest.fn(),
  canExecute: jest.fn(),
  execute: jest.fn(),
  processActionTrigger: jest.fn(),
};

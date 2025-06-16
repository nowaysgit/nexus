/**
 * Централизованный файл с моками для тестов
 */

import { jest } from '@jest/globals';
import { mockLlamaProviderService } from './llama-provider.mock';

// Мок для LogService
export const MockLogService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  critical: jest.fn(),
  info: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
  getContext: jest.fn().mockReturnValue('TestContext'),
  forContext: jest.fn().mockReturnThis(),
  onModuleDestroy: jest.fn(),
};

// Мок для RollbarService
export const MockRollbarService = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  critical: jest.fn(),
  onModuleInit: jest.fn(),
  enabled: false,
};

// Мок для ConfigService
export const createMockConfigService = () => ({
  get: jest.fn().mockImplementation(key => {
    if (key === 'database') {
      return {
        host: 'localhost',
        port: 5433,
        username: 'test_user',
        password: 'test_password',
        database: 'nexus_test',
      };
    }
    if (key === 'telegram.token') return 'fake-token';
    if (key === 'telegram.webhook') return 'fake-webhook';
    if (key === 'telegram.secret') return 'fake-secret';
    if (key === 'llm.provider') return 'llama';
    if (key === 'logging.rollbar')
      return {
        enabled: false,
        accessToken: 'fake-token',
        environment: 'test',
        captureUncaught: false,
        captureUnhandledRejections: false,
      };
    if (key === 'logging.rollbar.enabled') return false;
    if (key === 'logging.logger.level') return 'info';
    return null;
  }),
});
// Мок для UserService
export const MockUserService = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// Мок для NeedsService
export const MockNeedsService = {
  getActiveNeeds: jest.fn(),
  updateNeeds: jest.fn(),
  calculatePriority: jest.fn(),
  getNeedsByCharacterId: jest.fn(),
  getNeeds: jest.fn(),
};

// Мок для LLMProviderManagerService
export const MockLLMProviderManagerService = {
  getProvider: jest.fn().mockImplementation(() => mockLlamaProviderService),
  getAvailableProviders: jest.fn().mockImplementation(() => [mockLlamaProviderService]),
  isProviderAvailable: jest.fn().mockImplementation(() => true),
  onModuleInit: jest.fn(),
  generateJSON: jest.fn().mockImplementation(async () => ({})),
};

// Мок для EmotionalStateService
export const MockEmotionalStateService = {
  getEmotionalState: jest.fn(),
  updateEmotionalState: jest.fn(),
  getEmotionalManifestations: jest.fn(),
};

// Мок для TelegramService
export const MockTelegramService = {
  sendMessage: jest.fn(),
  getMe: jest.fn(),
  onModuleInit: jest.fn(),
  onApplicationShutdown: jest.fn(),
};

// Мок для MemoryService
export const MockMemoryService = {
  createMemory: jest.fn(),
  createActionMemory: jest.fn(),
  createEventMemory: jest.fn(),
  createMessageMemory: jest.fn(),
  getRecentMemories: jest.fn(),
  getImportantMemories: jest.fn(),
  searchMemoriesByKeywords: jest.fn(),
  limitMemoriesCount: jest.fn(),
  updateMemoryImportance: jest.fn(),
  markMemoryAsRecalled: jest.fn(),
};

// Мок для EventEmitter
export class MockEventEmitter {
  emit = jest.fn();
  on = jest.fn();
  once = jest.fn();
  removeListener = jest.fn();
  removeAllListeners = jest.fn();
}

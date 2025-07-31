import { Test, TestingModule } from '@nestjs/testing';
import { TelegramInitializationService } from '../../../src/telegram/services/telegram-initialization.service';
import { LogService } from '../../../src/logging/log.service';
import { SessionData } from '../../../src/telegram/interfaces/context.interface';

describe('TelegramInitializationService', () => {
  let service: TelegramInitializationService;
  let mockLogService: jest.Mocked<LogService>;

  beforeEach(async () => {
    mockLogService = {
      onModuleDestroy: jest.fn(),
      setContext: jest.fn().mockReturnThis(),
      getContext: jest.fn(),
      forContext: jest.fn().mockReturnThis(),
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      verbose: jest.fn(),
      error: jest.fn(),
      critical: jest.fn(),
    } as unknown as jest.Mocked<LogService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramInitializationService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    }).compile();

    service = module.get<TelegramInitializationService>(TelegramInitializationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should set context on log service', () => {
      expect(mockLogService.setContext).toHaveBeenCalledWith('TelegramInitializationService');
    });
  });

  describe('onModuleInit', () => {
    it('should log initialization message', async () => {
      await service.onModuleInit();

      expect(mockLogService.log).toHaveBeenCalledWith('Telegram инициализация запущена');
    });
  });

  describe('onApplicationShutdown', () => {
    it('should log shutdown message with signal', () => {
      service.onApplicationShutdown('SIGTERM');

      expect(mockLogService.log).toHaveBeenCalledWith(
        'Остановка Telegram инициализации (сигнал: SIGTERM)',
      );
    });

    it('should log shutdown message without signal', () => {
      service.onApplicationShutdown();

      expect(mockLogService.log).toHaveBeenCalledWith(
        'Остановка Telegram инициализации (сигнал: неизвестный)',
      );
    });

    it('should clear user sessions on shutdown', () => {
      const userId = 123;
      const sessionData: SessionData = { state: 'test', data: { key: 'value' } };

      service.setSession(userId, sessionData);
      expect(service.getSession(userId)).toEqual(sessionData);

      service.onApplicationShutdown('SIGTERM');
      expect(service.getSession(userId)).toBeUndefined();
    });
  });

  describe('session management', () => {
    const userId = 123;
    const sessionData: SessionData = {
      state: 'active',
      data: { characterId: 456, lastAction: 'message' },
    };

    describe('getSession and setSession', () => {
      it('should return undefined for non-existent session', () => {
        expect(service.getSession(userId)).toBeUndefined();
      });

      it('should set and get session correctly', () => {
        service.setSession(userId, sessionData);

        expect(service.getSession(userId)).toEqual(sessionData);
      });

      it('should overwrite existing session', () => {
        const initialSession: SessionData = { state: 'initial', data: {} };
        const newSession: SessionData = { state: 'updated', data: { key: 'value' } };

        service.setSession(userId, initialSession);
        expect(service.getSession(userId)).toEqual(initialSession);

        service.setSession(userId, newSession);
        expect(service.getSession(userId)).toEqual(newSession);
      });
    });

    describe('isInState', () => {
      it('should return false for non-existent session', () => {
        expect(service.isInState(userId, 'any')).toBe(false);
      });

      it('should return true when user is in specified state', () => {
        service.setSession(userId, { state: 'waiting_input', data: {} });

        expect(service.isInState(userId, 'waiting_input')).toBe(true);
      });

      it('should return false when user is not in specified state', () => {
        service.setSession(userId, { state: 'active', data: {} });

        expect(service.isInState(userId, 'waiting_input')).toBe(false);
      });

      it('should handle empty string state', () => {
        service.setSession(userId, { state: '', data: {} });

        expect(service.isInState(userId, '')).toBe(true);
        expect(service.isInState(userId, 'active')).toBe(false);
      });
    });

    describe('clearSession', () => {
      it('should remove existing session', () => {
        service.setSession(userId, sessionData);
        expect(service.getSession(userId)).toEqual(sessionData);

        service.clearSession(userId);
        expect(service.getSession(userId)).toBeUndefined();
      });

      it('should handle clearing non-existent session gracefully', () => {
        expect(() => service.clearSession(userId)).not.toThrow();
        expect(service.getSession(userId)).toBeUndefined();
      });
    });

    describe('setInitialState', () => {
      it('should set initial state with empty data', () => {
        service.setInitialState(userId);

        const session = service.getSession(userId);
        expect(session).toEqual({ state: 'initial', data: {} });
      });

      it('should overwrite existing session with initial state', () => {
        service.setSession(userId, { state: 'complex', data: { key: 'value' } });

        service.setInitialState(userId);

        const session = service.getSession(userId);
        expect(session).toEqual({ state: 'initial', data: {} });
      });
    });

    describe('updateSessionData', () => {
      it('should update existing session data', () => {
        const initialSession: SessionData = {
          state: 'active',
          data: { characterId: 456, name: 'Alice' },
        };
        service.setSession(userId, initialSession);

        service.updateSessionData(userId, { lastMessage: 'Hello', characterId: 789 });

        const session = service.getSession(userId);
        expect(session).toEqual({
          state: 'active',
          data: {
            characterId: 789, // updated
            name: 'Alice', // preserved
            lastMessage: 'Hello', // added
          },
        });
      });

      it('should handle updating non-existent session gracefully', () => {
        expect(() => service.updateSessionData(userId, { key: 'value' })).not.toThrow();
        expect(service.getSession(userId)).toBeUndefined();
      });

      it('should handle empty data update', () => {
        const initialSession: SessionData = { state: 'active', data: { key: 'value' } };
        service.setSession(userId, initialSession);

        service.updateSessionData(userId, {});

        const session = service.getSession(userId);
        expect(session).toEqual(initialSession);
      });

      it('should handle complex data types', () => {
        const initialSession: SessionData = {
          state: 'active',
          data: { settings: { theme: 'dark' } },
        };
        service.setSession(userId, initialSession);

        service.updateSessionData(userId, {
          settings: { theme: 'light', language: 'en' },
          preferences: ['pref1', 'pref2'],
        });

        const session = service.getSession(userId);
        expect(session).toEqual({
          state: 'active',
          data: {
            settings: { theme: 'light', language: 'en' },
            preferences: ['pref1', 'pref2'],
          },
        });
      });
    });

    describe('transitionTo', () => {
      it('should transition to new state without data', () => {
        service.setSession(userId, { state: 'initial', data: { key: 'value' } });

        service.transitionTo(userId, 'waiting_input');

        const session = service.getSession(userId);
        expect(session).toEqual({
          state: 'waiting_input',
          data: { key: 'value' }, // existing data preserved
        });
      });

      it('should transition to new state with data', () => {
        service.setSession(userId, { state: 'initial', data: { oldKey: 'oldValue' } });

        service.transitionTo(userId, 'processing', { newKey: 'newValue', step: 1 });

        const session = service.getSession(userId);
        expect(session).toEqual({
          state: 'processing',
          data: {
            oldKey: 'oldValue', // preserved
            newKey: 'newValue', // added
            step: 1, // added
          },
        });
      });

      it('should create new session if none exists', () => {
        service.transitionTo(userId, 'new_state', { key: 'value' });

        const session = service.getSession(userId);
        expect(session).toEqual({
          state: 'new_state',
          data: { key: 'value' },
        });
      });

      it('should handle transitioning without existing data', () => {
        service.transitionTo(userId, 'new_state');

        const session = service.getSession(userId);
        expect(session).toEqual({
          state: 'new_state',
          data: {},
        });
      });

      it('should overwrite conflicting data keys', () => {
        service.setSession(userId, {
          state: 'initial',
          data: { key: 'oldValue', otherKey: 'preserved' },
        });

        service.transitionTo(userId, 'updated', { key: 'newValue' });

        const session = service.getSession(userId);
        expect(session).toEqual({
          state: 'updated',
          data: {
            key: 'newValue', // overwritten
            otherKey: 'preserved', // preserved
          },
        });
      });
    });
  });

  describe('multiple users', () => {
    it('should handle multiple user sessions independently', () => {
      const user1 = 123;
      const user2 = 456;

      const session1: SessionData = { state: 'state1', data: { key: 'value1' } };
      const session2: SessionData = { state: 'state2', data: { key: 'value2' } };

      service.setSession(user1, session1);
      service.setSession(user2, session2);

      expect(service.getSession(user1)).toEqual(session1);
      expect(service.getSession(user2)).toEqual(session2);

      // Clear one session shouldn't affect the other
      service.clearSession(user1);
      expect(service.getSession(user1)).toBeUndefined();
      expect(service.getSession(user2)).toEqual(session2);
    });

    it('should handle state checks for multiple users', () => {
      const user1 = 123;
      const user2 = 456;

      service.setSession(user1, { state: 'waiting', data: {} });
      service.setSession(user2, { state: 'active', data: {} });

      expect(service.isInState(user1, 'waiting')).toBe(true);
      expect(service.isInState(user1, 'active')).toBe(false);
      expect(service.isInState(user2, 'active')).toBe(true);
      expect(service.isInState(user2, 'waiting')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle negative user IDs', () => {
      const userId = -123;
      const sessionData: SessionData = { state: 'test', data: {} };

      service.setSession(userId, sessionData);
      expect(service.getSession(userId)).toEqual(sessionData);
    });

    it('should handle zero user ID', () => {
      const userId = 0;
      const sessionData: SessionData = { state: 'test', data: {} };

      service.setSession(userId, sessionData);
      expect(service.getSession(userId)).toEqual(sessionData);
    });

    it('should handle very large user IDs', () => {
      const userId = Number.MAX_SAFE_INTEGER;
      const sessionData: SessionData = { state: 'test', data: {} };

      service.setSession(userId, sessionData);
      expect(service.getSession(userId)).toEqual(sessionData);
    });

    it('should handle undefined and null values in session data', () => {
      const userId = 123;

      service.setSession(userId, { state: 'test', data: { key: undefined, nullKey: null } });
      service.updateSessionData(userId, { undefinedKey: undefined });

      const session = service.getSession(userId);
      expect(session?.data).toEqual({
        key: undefined,
        nullKey: null,
        undefinedKey: undefined,
      });
    });
  });
});

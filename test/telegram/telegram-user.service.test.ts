import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TelegramUserService,
  InitializationResult,
  UserSettings,
} from '../../src/telegram/services/telegram-user.service';
import { UserService } from '../../src/user/services/user.service';
import { AccessKey } from '../../src/user/entities/access-key.entity';
import { TelegramCharacterSettings } from '../../src/telegram/entities/character-settings.entity';
import { MessageService } from '../../src/telegram/services/message.service';
import { CacheService } from '../../src/cache/cache.service';
import { LogService } from '../../src/logging/log.service';
import { Context } from '../../src/telegram/interfaces/context.interface';
import { User } from '../../src/user/entities/user.entity';

describe('TelegramUserService', () => {
  let service: TelegramUserService;
  let userService: jest.Mocked<UserService>;
  let accessKeyRepository: jest.Mocked<Repository<AccessKey>>;
  let characterSettingsRepository: jest.Mocked<Repository<TelegramCharacterSettings>>;
  let messageService: jest.Mocked<MessageService>;
  let cacheService: jest.Mocked<CacheService>;
  let logService: jest.Mocked<LogService>;

  const mockUser: User = {
    id: 'user-1',
    telegramId: '123456789',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    language: 'ru',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivity: new Date(),
    characters: [],
    messagesCount: 0,
  } as User;

  const mockContext = {
    from: {
      id: 123456789,
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
      language_code: 'ru',
    },
    session: { state: 'main' },
    reply: jest.fn(),
  } as unknown as Context;

  beforeEach(async () => {
    const mockUserService = {
      findByTelegramId: jest.fn(),
      createUser: jest.fn(),
      updateLastActivity: jest.fn(),
      updateUser: jest.fn(),
    };

    const mockAccessKeyRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const mockCharacterSettingsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    const mockMessageService = {
      sendMessage: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockLogService = {
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramUserService,
        { provide: UserService, useValue: mockUserService },
        { provide: getRepositoryToken(AccessKey), useValue: mockAccessKeyRepository },
        {
          provide: getRepositoryToken(TelegramCharacterSettings),
          useValue: mockCharacterSettingsRepository,
        },
        { provide: MessageService, useValue: mockMessageService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: LogService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<TelegramUserService>(TelegramUserService);
    userService = module.get(UserService);
    accessKeyRepository = module.get(getRepositoryToken(AccessKey));
    characterSettingsRepository = module.get(getRepositoryToken(TelegramCharacterSettings));
    messageService = module.get(MessageService);
    cacheService = module.get(CacheService);
    logService = module.get(LogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('должен быть определен', () => {
      expect(service).toBeDefined();
    });
  });

  describe('initializeUser', () => {
    it('должен создать нового пользователя', async () => {
      userService.findByTelegramId.mockResolvedValue(null);
      userService.createUser.mockResolvedValue(mockUser);

      const result: InitializationResult = await service.initializeUser(mockContext);

      expect(result.success).toBe(true);
      expect(result.isNewUser).toBe(true);
      expect(result.userId).toBe(mockUser.id);
      expect(userService.createUser).toHaveBeenCalledWith({
        telegramId: '123456789',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        language: 'ru',
      });
    });

    it('должен найти существующего пользователя', async () => {
      userService.findByTelegramId.mockResolvedValue(mockUser);
      userService.updateLastActivity.mockResolvedValue(undefined);

      const result: InitializationResult = await service.initializeUser(mockContext);

      expect(result.success).toBe(true);
      expect(result.isNewUser).toBe(false);
      expect(result.userId).toBe(mockUser.id);
      expect(userService.updateLastActivity).toHaveBeenCalledWith(mockUser.id);
    });

    it('должен обработать отсутствие ID пользователя', async () => {
      const contextWithoutId = { ...mockContext, from: null };

      const result = await service.initializeUser(contextWithoutId as Context);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Не удалось получить ID пользователя');
    });

    it('должен обработать ошибку создания пользователя', async () => {
      const error = new Error('Database error');
      userService.findByTelegramId.mockRejectedValue(error);

      const result: InitializationResult = await service.initializeUser(mockContext);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Ошибка инициализации');
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe('checkUserAccess', () => {
    it('должен вернуть true для активного пользователя', async () => {
      userService.findByTelegramId.mockResolvedValue(mockUser);

      const result = await service.checkUserAccess(mockContext);

      expect(result).toBe(true);
    });

    it('должен вернуть false для неактивного пользователя', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      userService.findByTelegramId.mockResolvedValue(inactiveUser);

      const result = await service.checkUserAccess(mockContext);

      expect(result).toBe(false);
    });

    it('должен вернуть false для несуществующего пользователя', async () => {
      userService.findByTelegramId.mockResolvedValue(null);

      const result = await service.checkUserAccess(mockContext);

      expect(result).toBe(false);
    });

    it('должен вернуть false при отсутствии ID пользователя', async () => {
      const contextWithoutId = { ...mockContext, from: null };

      const result = await service.checkUserAccess(contextWithoutId as Context);

      expect(result).toBe(false);
    });

    it('должен обработать ошибку проверки доступа', async () => {
      const error = new Error('Database error');
      userService.findByTelegramId.mockRejectedValue(error);

      const result = await service.checkUserAccess(mockContext);

      expect(result).toBe(false);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe('checkAccess', () => {
    it('должен разрешить доступ для пользователя с активным ключом доступа', async () => {
      const mockAccessKey = {
        id: 1,
        key: 'TEST-KEY-123',
        isActive: true,
        isUsed: false,
        usedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: mockUser.id,
        user: mockUser,
      };

      userService.findByTelegramId.mockResolvedValue(mockUser);
      accessKeyRepository.findOne.mockResolvedValue(mockAccessKey);
      mockContext.reply = jest.fn().mockResolvedValue(undefined);

      const result = await service.checkAccess(mockContext);

      expect(result).toBe(true);
    });

    it('должен запросить ключ доступа для пользователя без доступа', async () => {
      userService.findByTelegramId.mockResolvedValue(null);
      mockContext.reply = jest.fn().mockResolvedValue(undefined);

      const result = await service.checkAccess(mockContext);

      expect(result).toBe(false);
      expect(mockContext.reply).toHaveBeenCalled();
    });

    it('должен обработать ошибку в checkAccess', async () => {
      const error = new Error('Access check error');
      userService.findByTelegramId.mockRejectedValue(error);
      mockContext.reply = jest.fn().mockResolvedValue(undefined);

      const result = await service.checkAccess(mockContext);

      expect(result).toBe(false);
    });
  });

  describe('validateAccessKey', () => {
    it('должен валидировать корректный ключ доступа', async () => {
      const mockAccessKey = {
        id: 1,
        key: 'TEST-KEY-123',
        isActive: true,
        isUsed: false,
        userId: null,
        user: null,
        usedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      accessKeyRepository.findOne.mockResolvedValue(mockAccessKey);
      userService.createUser.mockResolvedValue(mockUser);
      userService.updateUser.mockResolvedValue(mockUser);
      accessKeyRepository.save.mockResolvedValue({ ...mockAccessKey, isUsed: true });
      mockContext.reply = jest.fn().mockResolvedValue(undefined);
      messageService.sendMainMenu = jest.fn().mockResolvedValue(undefined);

      const result = await service.validateAccessKey(mockContext, 'TEST-KEY-123');

      expect(result).toBe(true);
      expect(accessKeyRepository.findOne).toHaveBeenCalledWith({
        where: { key: 'TEST-KEY-123', isActive: true },
      });
      expect(userService.createUser).toHaveBeenCalled();
      expect(userService.updateUser).toHaveBeenCalled();
    });

    it('должен отклонить некорректный ключ доступа', async () => {
      accessKeyRepository.findOne.mockResolvedValue(null);
      mockContext.reply = jest.fn().mockResolvedValue(undefined);

      const result = await service.validateAccessKey(mockContext, 'INVALID-KEY');

      expect(result).toBe(false);
      expect(mockContext.reply).toHaveBeenCalledWith(
        'Неверный ключ доступа или ключ был деактивирован. Пожалуйста, попробуйте еще раз.',
      );
    });

    it('должен обработать уже использованный ключ', async () => {
      const usedKey = {
        id: 1,
        key: 'TEST-KEY-123',
        isActive: true,
        isUsed: true,
        userId: null,
        user: null,
        usedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      accessKeyRepository.findOne.mockResolvedValue(usedKey);
      mockContext.reply = jest.fn().mockResolvedValue(undefined);

      const result = await service.validateAccessKey(mockContext, 'TEST-KEY-123');

      expect(result).toBe(false);
    });

    it('должен обработать ошибку получения ID пользователя', async () => {
      const mockAccessKey = {
        id: 1,
        key: 'TEST-KEY-123',
        isActive: true,
        isUsed: false,
        userId: null,
        user: null,
        usedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const contextWithoutId = { ...mockContext, from: null };
      accessKeyRepository.findOne.mockResolvedValue(mockAccessKey);

      const result = await service.validateAccessKey(contextWithoutId as Context, 'TEST-KEY-123');

      expect(result).toBe(false);
    });

    it('должен обработать ошибку валидации', async () => {
      const error = new Error('Validation error');
      accessKeyRepository.findOne.mockRejectedValue(error);
      mockContext.reply = jest.fn().mockResolvedValue(undefined);

      const result = await service.validateAccessKey(mockContext, 'TEST-KEY-123');

      expect(result).toBe(false);
    });
  });

  describe('getUserSettings', () => {
    it('должен получить настройки пользователя', async () => {
      const userWithPreferences = {
        ...mockUser,
        preferences: {
          notifications: true,
          autoActions: false,
          characterSettings: { test: 'value' },
        },
      };

      userService.findByTelegramId.mockResolvedValue(userWithPreferences);

      const result = await service.getUserSettings(mockContext);

      expect(result).toEqual({
        language: 'ru',
        notifications: true,
        autoActions: false,
        characterSettings: { test: 'value' },
      });
    });

    it('должен вернуть null для несуществующего пользователя', async () => {
      userService.findByTelegramId.mockResolvedValue(null);

      const result = await service.getUserSettings(mockContext);

      expect(result).toBeNull();
    });
  });

  describe('updateUserSettings', () => {
    it('должен обновить настройки пользователя', async () => {
      const settings: Partial<UserSettings> = {
        notifications: false,
        autoActions: true,
      };

      userService.findByTelegramId.mockResolvedValue(mockUser);
      userService.updateUser.mockResolvedValue(mockUser);

      const result = await service.updateUserSettings(mockContext, settings);

      expect(result).toBe(true);
      expect(userService.updateUser).toHaveBeenCalled();
    });
  });

  describe('generateAccessKey', () => {
    it('должен генерировать новый ключ доступа', async () => {
      const mockAccessKey = {
        id: 1,
        key: 'GENERATED-KEY',
        isActive: true,
        isUsed: false,
        userId: null,
        user: null,
        usedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      accessKeyRepository.create.mockReturnValue(mockAccessKey);
      accessKeyRepository.save.mockResolvedValue(mockAccessKey);

      const result = await service.generateAccessKey(10, 30);

      expect(result).toBeDefined();
      expect(result.key).toBeDefined();
      expect(accessKeyRepository.save).toHaveBeenCalled();
    });

    it('должен обработать ошибку генерации ключа', async () => {
      const error = new Error('Generation error');
      accessKeyRepository.save.mockRejectedValue(error);

      await expect(service.generateAccessKey()).rejects.toThrow(
        'Не удалось сгенерировать ключ доступа',
      );
    });
  });

  describe('error handling', () => {
    it('должен обрабатывать ошибки в getUserStats', async () => {
      const error = new Error('Stats error');
      userService.findByTelegramId.mockRejectedValue(error);

      const result = await service.getUserStats(mockContext);

      expect(result).toBeNull();
      expect(logService.error).toHaveBeenCalled();
    });
  });
});

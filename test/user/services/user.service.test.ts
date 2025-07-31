import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UserService, PaginationOptions } from '../../../src/user/services/user.service';
import { User } from '../../../src/user/entities/user.entity';
import { AccessKey } from '../../../src/user/entities/access-key.entity';
import {
  PsychologicalTest,
  PersonalityType,
} from '../../../src/user/entities/psychological-test.entity';
import { CreateUserDto } from '../../../src/user/dto/create-user.dto';
import { UpdateUserDto } from '../../../src/user/dto/update-user.dto';
import { CacheService } from '../../../src/cache/cache.service';
import { CacheStats } from '../../../src/cache/cache.interface';
import { LogService } from '../../../src/logging/log.service';
import * as crypto from 'crypto';

jest.mock('crypto');

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<Repository<User>>;
  let accessKeyRepository: jest.Mocked<Repository<AccessKey>>;
  let testRepository: jest.Mocked<Repository<PsychologicalTest>>;
  let cacheService: jest.Mocked<CacheService>;
  let logService: jest.Mocked<LogService>;

  const mockUser = {
    id: '1',
    telegramId: 'telegram123',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashed-password',
    roles: ['user'],
    firstName: 'Test',
    lastName: 'User',
    language: 'ru',
    isActive: true,
    isAdmin: false,
    hasActivatedKey: true,
    hasCompletedTest: false,
    messagesCount: 0,
    testCompletedAt: null,
    preferences: null,
    communicationStyle: { formality: 0.5 },
    lastActivity: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    characters: [],
    dialogs: [],
    accessKeys: [],
    psychologicalTests: [],
  };

  const mockAccessKey = {
    id: 1,
    key: 'test-key-123',
    isActive: true,
    isUsed: false,
    userId: '1',
    user: mockUser,
    usedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockPsychologicalTest = {
    id: 1,
    userId: '1',
    user: mockUser,
    answers: { 1: 5, 2: 3 },
    scores: { openness: 0.8, conscientiousness: 0.6 },
    personalityType: PersonalityType.ANALYTICAL,
    additionalNotes: 'Test notes',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const mockUserRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockAccessKeyRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const mockTestRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const mockCacheService = {
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      getStats: jest.fn(),
    };

    const mockLogService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      setContext: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(AccessKey),
          useValue: mockAccessKeyRepository,
        },
        {
          provide: getRepositoryToken(PsychologicalTest),
          useValue: mockTestRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(getRepositoryToken(User));
    accessKeyRepository = module.get(getRepositoryToken(AccessKey));
    testRepository = module.get(getRepositoryToken(PsychologicalTest));
    cacheService = module.get(CacheService);
    logService = module.get(LogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('CRUD Operations', () => {
    describe('createUser', () => {
      it('should create and cache a new user', async () => {
        const createUserDto: CreateUserDto = {
          telegramId: 'telegram123',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
        };

        userRepository.create.mockReturnValue(mockUser as any);
        userRepository.save.mockResolvedValue(mockUser as any);
        cacheService.set.mockResolvedValue(undefined);

        const result = await service.createUser(createUserDto);

        expect(userRepository.create).toHaveBeenCalledWith(createUserDto);
        expect(userRepository.save).toHaveBeenCalledWith(mockUser);
        expect(cacheService.set).toHaveBeenCalledWith(`user:${mockUser.id}`, mockUser, 300);
        expect(result).toEqual(mockUser);
      });
    });

    describe('findAllPaginated', () => {
      it('should return paginated users with default options', async () => {
        const users = [mockUser];
        const total = 1;
        userRepository.findAndCount.mockResolvedValue([users as any, total]);

        const result = await service.findAllPaginated();

        expect(userRepository.findAndCount).toHaveBeenCalledWith({
          skip: 0,
          take: 10,
          order: { createdAt: 'DESC' },
        });
        expect(result).toEqual({
          data: users,
          total,
          page: 1,
          limit: 10,
          totalPages: 1,
        });
      });

      it('should return paginated users with custom options', async () => {
        const users = [mockUser];
        const total = 25;
        const options: PaginationOptions = {
          page: 2,
          limit: 5,
          sortBy: 'username',
          sortOrder: 'ASC',
        };
        userRepository.findAndCount.mockResolvedValue([users as any, total]);

        const result = await service.findAllPaginated(options);

        expect(userRepository.findAndCount).toHaveBeenCalledWith({
          skip: 5,
          take: 5,
          order: { username: 'ASC' },
        });
        expect(result).toEqual({
          data: users,
          total,
          page: 2,
          limit: 5,
          totalPages: 5,
        });
      });
    });

    describe('findUserById', () => {
      it('should return cached user if available', async () => {
        cacheService.get.mockResolvedValue(mockUser as any);

        const result = await service.findUserById('1');

        expect(cacheService.get).toHaveBeenCalledWith('user:1');
        expect(userRepository.findOne).not.toHaveBeenCalled();
        expect(result).toEqual(mockUser);
      });

      it('should fetch from database and cache if not in cache', async () => {
        cacheService.get.mockResolvedValue(null);
        userRepository.findOne.mockResolvedValue(mockUser as any);
        cacheService.set.mockResolvedValue(undefined);

        const result = await service.findUserById('1', ['characters']);

        expect(cacheService.get).toHaveBeenCalledWith('user:1');
        expect(userRepository.findOne).toHaveBeenCalledWith({
          where: { id: '1' },
          relations: ['characters'],
        });
        expect(result).toEqual(mockUser);
      });

      it('should throw NotFoundException if user not found', async () => {
        cacheService.get.mockResolvedValue(null);
        userRepository.findOne.mockResolvedValue(null);

        await expect(service.findUserById('1')).rejects.toThrow(
          new NotFoundException('Пользователь с ID 1 не найден'),
        );
      });
    });

    describe('findByTelegramId', () => {
      it('should return cached user if available', async () => {
        cacheService.get.mockResolvedValue(mockUser as any);

        const result = await service.findByTelegramId('telegram123');

        expect(cacheService.get).toHaveBeenCalledWith('user:telegram:telegram123');
        expect(userRepository.findOne).not.toHaveBeenCalled();
        expect(result).toEqual(mockUser);
      });

      it('should fetch from database and cache if not in cache', async () => {
        cacheService.get.mockResolvedValue(null);
        userRepository.findOne.mockResolvedValue(mockUser as any);
        cacheService.set.mockResolvedValue(undefined);

        const result = await service.findByTelegramId('telegram123');

        expect(cacheService.get).toHaveBeenCalledWith('user:telegram:telegram123');
        expect(userRepository.findOne).toHaveBeenCalledWith({
          where: { telegramId: 'telegram123' },
        });
        expect(result).toEqual(mockUser);
      });

      it('should throw NotFoundException if user not found', async () => {
        cacheService.get.mockResolvedValue(null);
        userRepository.findOne.mockResolvedValue(null);

        await expect(service.findByTelegramId('telegram123')).rejects.toThrow(
          new NotFoundException('Пользователь с Telegram ID telegram123 не найден'),
        );
      });
    });

    describe('updateUser', () => {
      it('should update user and refresh cache', async () => {
        const updateUserDto: UpdateUserDto = { firstName: 'Updated' };
        const updatedUser = { ...mockUser, firstName: 'Updated' };

        userRepository.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });
        userRepository.findOne.mockResolvedValue(updatedUser as any);
        cacheService.delete.mockResolvedValue(undefined);
        cacheService.set.mockResolvedValue(undefined);

        const result = await service.updateUser('1', updateUserDto);

        expect(userRepository.update).toHaveBeenCalledWith('1', updateUserDto);
        expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
        expect(result).toEqual(updatedUser);
      });

      it('should throw NotFoundException if updated user not found', async () => {
        const updateUserDto: UpdateUserDto = { firstName: 'Updated' };

        userRepository.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });
        userRepository.findOne.mockResolvedValue(null);

        await expect(service.updateUser('1', updateUserDto)).rejects.toThrow(
          new NotFoundException('Пользователь с ID 1 не найден'),
        );
      });
    });

    describe('remove', () => {
      it('should remove user and invalidate cache', async () => {
        cacheService.get.mockResolvedValue(null);
        userRepository.findOne.mockResolvedValue(mockUser as any);
        userRepository.delete.mockResolvedValue({ affected: 1, raw: {} });
        cacheService.delete.mockResolvedValue(undefined);

        await service.remove('1');

        expect(userRepository.delete).toHaveBeenCalledWith('1');
      });
    });
  });

  describe('Cache Management', () => {
    describe('cacheUser', () => {
      it('should cache user by id and telegramId', async () => {
        cacheService.set.mockResolvedValue(undefined);

        await service.cacheUser(mockUser as any);

        expect(cacheService.set).toHaveBeenCalledWith(`user:${mockUser.id}`, mockUser, 300);
        expect(cacheService.set).toHaveBeenCalledWith(
          `user:telegram:${mockUser.telegramId}`,
          mockUser,
          300,
        );
      });

      it('should cache user by id only if no telegramId', async () => {
        const userWithoutTelegram = { ...mockUser, telegramId: null };
        cacheService.set.mockResolvedValue(undefined);

        await service.cacheUser(userWithoutTelegram as any);

        expect(cacheService.set).toHaveBeenCalledWith(
          `user:${userWithoutTelegram.id}`,
          userWithoutTelegram,
          300,
        );
        expect(cacheService.set).toHaveBeenCalledTimes(1);
      });
    });

    describe('getCachedUser', () => {
      it('should get cached user by id', async () => {
        cacheService.get.mockResolvedValue(mockUser as any);

        const result = await service.getCachedUser('1');

        expect(cacheService.get).toHaveBeenCalledWith('user:1');
        expect(result).toEqual(mockUser);
      });
    });

    describe('getCachedUserByTelegramId', () => {
      it('should get cached user by telegram id', async () => {
        cacheService.get.mockResolvedValue(mockUser as any);

        const result = await service.getCachedUserByTelegramId('telegram123');

        expect(cacheService.get).toHaveBeenCalledWith('user:telegram:telegram123');
        expect(result).toEqual(mockUser);
      });
    });

    describe('invalidateUserCache', () => {
      it('should invalidate cache for user with telegramId', async () => {
        cacheService.delete.mockResolvedValue(undefined);

        await service.invalidateUserCache(mockUser as any);

        expect(cacheService.delete).toHaveBeenCalledWith('user:1');
        expect(cacheService.delete).toHaveBeenCalledWith('user:telegram:telegram123');
      });

      it('should invalidate cache for user without telegramId', async () => {
        const userWithoutTelegram = { ...mockUser, telegramId: null };
        cacheService.delete.mockResolvedValue(undefined);

        await service.invalidateUserCache(userWithoutTelegram as any);

        expect(cacheService.delete).toHaveBeenCalledWith('user:1');
        expect(cacheService.delete).toHaveBeenCalledTimes(1);
      });
    });

    describe('resetCache', () => {
      it('should log cache reset', async () => {
        await service.resetCache();

        expect(logService.log).toHaveBeenCalledWith(
          'Кэш пользователей сброшен (через CacheService)',
        );
      });
    });

    describe('getCacheStats', () => {
      it('should return cache stats', async () => {
        const mockStats: CacheStats = {
          size: 10,
          hitRate: 0.8,
          hits: 10,
          misses: 5,
          totalRequests: 15,
          createdAt: new Date(),
        };
        cacheService.getStats.mockResolvedValue(mockStats);

        const result = await service.getCacheStats();

        expect(cacheService.getStats).toHaveBeenCalled();
        expect(result).toEqual(mockStats);
      });
    });
  });

  describe('Access Key Management', () => {
    describe('generateAccessKey', () => {
      it('should generate and save new access key', async () => {
        const mockKey = 'generated-key-123';

        // Mock crypto.randomBytes
        (crypto.randomBytes as jest.MockedFunction<typeof crypto.randomBytes>).mockReturnValue({
          toString: jest.fn().mockReturnValue(mockKey),
        } as any);

        cacheService.get.mockResolvedValue(null);
        userRepository.findOne.mockResolvedValue(mockUser as any);
        accessKeyRepository.create.mockReturnValue(mockAccessKey as any);
        accessKeyRepository.save.mockResolvedValue(mockAccessKey as any);

        const result = await service.generateAccessKey('1');

        expect(crypto.randomBytes).toHaveBeenCalledWith(16);
        expect(result).toEqual(mockKey);
      });
    });

    describe('activateAccessKey', () => {
      it('should activate access key successfully', async () => {
        const telegramId = 'new-telegram-id';
        const activeAccessKey = { ...mockAccessKey, isActive: true };

        accessKeyRepository.findOne.mockResolvedValue(activeAccessKey as any);
        userRepository.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });
        accessKeyRepository.save.mockResolvedValue({
          ...activeAccessKey,
          isActive: false,
          isUsed: true,
          usedAt: new Date(),
        } as any);
        cacheService.delete.mockResolvedValue(undefined);

        const result = await service.activateAccessKey('test-key-123', telegramId);

        expect(accessKeyRepository.findOne).toHaveBeenCalledWith({
          where: { key: 'test-key-123', isActive: true },
          relations: ['user'],
        });
        expect(result).toBe(true);
      });

      it('should return false for invalid key', async () => {
        accessKeyRepository.findOne.mockResolvedValue(null);

        const result = await service.activateAccessKey('invalid-key', 'telegram123');

        expect(result).toBe(false);
      });
    });

    describe('hasActivatedKey', () => {
      it('should return true if user has activated key', async () => {
        userRepository.findOne.mockResolvedValue(mockUser as any);

        const result = await service.hasActivatedKey('telegram123');

        expect(result).toBe(true);
      });

      it('should return false if user has not activated key', async () => {
        userRepository.findOne.mockResolvedValue(null);

        const result = await service.hasActivatedKey('telegram123');

        expect(result).toBe(false);
      });
    });
  });

  describe('Psychological Tests', () => {
    describe('saveTestResult', () => {
      it('should save test result for user', async () => {
        const testData = {
          answers: { 1: 5, 2: 3 },
          scores: { openness: 0.8 },
          personalityType: PersonalityType.ANALYTICAL,
          additionalNotes: 'Test notes',
        };

        cacheService.get.mockResolvedValue(null);
        userRepository.findOne.mockResolvedValue(mockUser as any);
        testRepository.create.mockReturnValue(mockPsychologicalTest as any);
        testRepository.save.mockResolvedValue(mockPsychologicalTest as any);

        await service.saveTestResult('telegram123', testData);

        expect(testRepository.save).toHaveBeenCalledWith(mockPsychologicalTest);
      });
    });

    describe('getTestResult', () => {
      it('should return latest test result', async () => {
        cacheService.get.mockResolvedValue(null);
        userRepository.findOne.mockResolvedValue(mockUser as any);
        testRepository.findOne.mockResolvedValue(mockPsychologicalTest as any);

        const result = await service.getTestResult('telegram123');

        expect(result).toEqual(mockPsychologicalTest);
      });

      it('should return null if no test found', async () => {
        cacheService.get.mockResolvedValue(null);
        userRepository.findOne.mockResolvedValue(mockUser as any);
        testRepository.findOne.mockResolvedValue(null);

        const result = await service.getTestResult('telegram123');

        expect(result).toBeNull();
      });
    });

    describe('markTestCompleted', () => {
      it('should mark test as completed and update cache', async () => {
        const updatedUser = { ...mockUser, hasCompletedTest: true, testCompletedAt: new Date() };

        userRepository.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });
        userRepository.findOne.mockResolvedValue(updatedUser as any);
        cacheService.delete.mockResolvedValue(undefined);
        cacheService.set.mockResolvedValue(undefined);

        const result = await service.markTestCompleted('1');

        expect(result).toEqual(updatedUser);
      });
    });

    describe('hasCompletedTest', () => {
      it('should return true if user completed test', async () => {
        userRepository.findOne.mockResolvedValue(mockUser as any);

        const result = await service.hasCompletedTest('telegram123');

        expect(result).toBe(true);
      });

      it('should return false if user has not completed test', async () => {
        userRepository.findOne.mockResolvedValue(null);

        const result = await service.hasCompletedTest('telegram123');

        expect(result).toBe(false);
      });
    });
  });

  describe('Utility Methods', () => {
    describe('getUserIdByTelegramId', () => {
      it('should return numeric user ID', async () => {
        const userWithNumericId = { ...mockUser, id: '123' };
        userRepository.findOne.mockResolvedValue(userWithNumericId as any);

        const result = await service.getUserIdByTelegramId('telegram123');

        expect(result).toBe(123);
      });

      it('should return null if user not found', async () => {
        userRepository.findOne.mockResolvedValue(null);

        const result = await service.getUserIdByTelegramId('telegram123');

        expect(result).toBeNull();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle repository errors in createUser', async () => {
      const createUserDto: CreateUserDto = {
        telegramId: 'telegram123',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
      };

      userRepository.create.mockReturnValue(mockUser as any);
      userRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(service.createUser(createUserDto)).rejects.toThrow('Database error');
    });

    it('should handle database errors in findUserById when cache fails', async () => {
      cacheService.get.mockRejectedValue(new Error('Cache error'));
      userRepository.findOne.mockResolvedValue(mockUser as any);
      cacheService.set.mockResolvedValue(undefined);

      // The service currently doesn't handle cache errors gracefully
      // This test validates the current behavior - cache errors are propagated
      await expect(service.findUserById('1')).rejects.toThrow('Cache error');
    });
  });
});

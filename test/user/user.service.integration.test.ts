import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserService } from '../../src/user/services/user.service';
import { User } from '../../src/user/entities/user.entity';
import { AccessKey } from '../../src/user/entities/access-key.entity';
import {
  PsychologicalTest,
  PersonalityType,
} from '../../src/user/entities/psychological-test.entity';
import { CreateUserDto } from '../../src/user/dto/create-user.dto';
import { UpdateUserDto } from '../../src/user/dto/update-user.dto';
import { LogService } from '../../src/logging/log.service';
import { CacheService } from '../../src/cache/cache.service';
import { NotFoundException } from '@nestjs/common';

describe('UserService Unit Tests', () => {
  let userService: UserService;
  let mockUserRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findAndCount: jest.Mock;
    count: jest.Mock;
    createQueryBuilder: jest.Mock;
    clear: jest.Mock;
  };
  let mockAccessKeyRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
  };
  let mockPsychologicalTestRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
  };
  let mockLogService: Partial<LogService>;
  let mockCacheService: Partial<CacheService>;

  beforeEach(async () => {
    // Создаем моки для репозиториев
    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
      clear: jest.fn(),
    };

    mockAccessKeyRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    mockPsychologicalTestRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    mockLogService = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    mockCacheService = {
      set: jest.fn(),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn(),
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
          useValue: mockPsychologicalTestRepository,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен создать нового пользователя', async () => {
    const createUserDto: CreateUserDto = {
      telegramId: '123456789',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      language: 'ru',
    };

    const mockUser = {
      id: 'user-1',
      telegramId: createUserDto.telegramId,
      username: createUserDto.username,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      language: createUserDto.language,
      isActive: true,
      hasCompletedTest: false,
      hasActivatedKey: false,
      messagesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUserRepository.create.mockReturnValue(mockUser);
    mockUserRepository.save.mockResolvedValue(mockUser);

    const result = await userService.createUser(createUserDto);

    expect(result).toBeDefined();
    expect(result.id).toBe('user-1');
    expect(result.telegramId).toBe(createUserDto.telegramId);
    expect(result.username).toBe(createUserDto.username);
    expect(result.firstName).toBe(createUserDto.firstName);
    expect(result.lastName).toBe(createUserDto.lastName);
    expect(result.language).toBe(createUserDto.language);
    expect(result.isActive).toBe(true);
    expect(result.hasCompletedTest).toBe(false);
    expect(result.hasActivatedKey).toBe(false);
    expect(result.messagesCount).toBe(0);
    expect(mockUserRepository.create).toHaveBeenCalledWith(createUserDto);
    expect(mockUserRepository.save).toHaveBeenCalledWith(mockUser);
    expect(mockCacheService.set).toHaveBeenCalled();
  });

  it('должен найти пользователя по ID', async () => {
    const userId = 'user-1';
    const mockUser = {
      id: userId,
      telegramId: '987654321',
      username: 'finduser',
      firstName: 'Find',
      lastName: 'User',
    };

    mockUserRepository.findOne.mockResolvedValue(mockUser);

    const result = await userService.findUserById(userId);

    expect(result).toBeDefined();
    expect(result.id).toBe(userId);
    expect(result.telegramId).toBe('987654321');
    expect(result.username).toBe('finduser');
    expect(mockUserRepository.findOne).toHaveBeenCalledWith({
      where: { id: userId },
      relations: [],
    });
    expect(mockCacheService.set).toHaveBeenCalled();
  });

  it('должен выбросить NotFoundException если пользователь не найден по ID', async () => {
    const userId = 'nonexistent-user';
    mockUserRepository.findOne.mockResolvedValue(null);

    await expect(userService.findUserById(userId)).rejects.toThrow(NotFoundException);
    expect(mockUserRepository.findOne).toHaveBeenCalledWith({
      where: { id: userId },
      relations: [],
    });
  });

  it('должен найти пользователя по Telegram ID', async () => {
    const telegramId = '555666777';
    const mockUser = {
      id: 'user-1',
      telegramId,
      username: 'telegramuser',
      firstName: 'Telegram',
      lastName: 'User',
    };

    mockUserRepository.findOne.mockResolvedValue(mockUser);

    const result = await userService.findByTelegramId(telegramId);

    expect(result).toBeDefined();
    expect(result.telegramId).toBe(telegramId);
    expect(result.username).toBe('telegramuser');
    expect(mockUserRepository.findOne).toHaveBeenCalledWith({
      where: { telegramId },
    });
    expect(mockCacheService.set).toHaveBeenCalled();
  });

  it('должен обновить данные пользователя', async () => {
    const userId = 'user-1';
    const updateDto: UpdateUserDto = {
      firstName: 'Updated',
      lastName: 'UserUpdated',
      language: 'en',
      preferences: {
        theme: 'dark',
        receiveNotifications: true,
      },
      communicationStyle: {
        formality: 3,
        emotionality: 2,
        verbosity: 4,
      },
    };

    const existingUser = {
      id: userId,
      telegramId: '123456789',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
    };

    const updatedUser = {
      ...existingUser,
      ...updateDto,
    };

    mockUserRepository.findOne.mockResolvedValue(updatedUser);

    const result = await userService.updateUser(userId, updateDto);

    expect(result).toBeDefined();
    expect(result.firstName).toBe('Updated');
    expect(result.lastName).toBe('UserUpdated');
    expect(result.language).toBe('en');
    expect(result.preferences).toEqual(updateDto.preferences);
    expect(result.communicationStyle).toEqual(updateDto.communicationStyle);
    expect(mockUserRepository.update).toHaveBeenCalledWith(userId, updateDto);
    expect(mockUserRepository.findOne).toHaveBeenCalledWith({
      where: { id: userId },
    });
    expect(mockCacheService.delete).toHaveBeenCalled();
    expect(mockCacheService.set).toHaveBeenCalled();
  });

  it('должен удалить пользователя', async () => {
    const userId = 'user-1';
    const mockUser = {
      id: userId,
      telegramId: '999888777',
      username: 'deleteuser',
      firstName: 'Delete',
      lastName: 'User',
    };

    mockUserRepository.findOne.mockResolvedValue(mockUser);

    await userService.remove(userId);

    expect(mockUserRepository.findOne).toHaveBeenCalledWith({
      where: { id: userId },
      relations: [],
    });
    expect(mockUserRepository.delete).toHaveBeenCalledWith(userId);
    expect(mockCacheService.delete).toHaveBeenCalled();
  });

  it('должен сгенерировать ключ доступа для пользователя', async () => {
    const userId = 'user-1';
    const mockUser = {
      id: userId,
      telegramId: '444555666',
      username: 'keyuser',
      firstName: 'Key',
      lastName: 'User',
    };

    const mockAccessKey = {
      id: 'key-1',
      key: 'generated-access-key-123',
      userId,
      user: mockUser,
      isActive: true,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    mockUserRepository.findOne.mockResolvedValue(mockUser);
    mockAccessKeyRepository.create.mockReturnValue(mockAccessKey);
    mockAccessKeyRepository.save.mockResolvedValue(mockAccessKey);

    const result = await userService.generateAccessKey(userId);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(mockUserRepository.findOne).toHaveBeenCalledWith({
      where: { id: userId },
      relations: [],
    });
    expect(mockAccessKeyRepository.create).toHaveBeenCalled();
    expect(mockAccessKeyRepository.save).toHaveBeenCalled();
  });

  it('должен активировать ключ доступа', async () => {
    const accessKey = 'test-access-key';
    const telegramId = '777888999';
    const mockUser = {
      id: 'user-1',
      telegramId,
      username: 'activateuser',
      firstName: 'Activate',
      lastName: 'User',
      hasActivatedKey: false,
    };

    const mockAccessKeyEntity = {
      id: 'key-1',
      key: accessKey,
      userId: mockUser.id,
      user: mockUser,
      isActive: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future date
    };

    const updatedUser = {
      ...mockUser,
      hasActivatedKey: true,
    };

    mockAccessKeyRepository.findOne.mockResolvedValue(mockAccessKeyEntity);
    mockUserRepository.update.mockResolvedValue(updatedUser);

    const result = await userService.activateAccessKey(accessKey, telegramId);

    expect(result).toBe(true);
    expect(mockAccessKeyRepository.findOne).toHaveBeenCalledWith({
      where: { key: accessKey, isActive: true },
      relations: ['user'],
    });
    expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.id, {
      telegramId,
      hasActivatedKey: true,
    });
    expect(mockAccessKeyRepository.save).toHaveBeenCalled();
  });

  it('должен создать психологический тест для пользователя', async () => {
    const telegramId = '123123123';
    const mockUser = {
      id: 'user-1',
      telegramId,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
    };

    const testData = {
      answers: { 1: 1, 2: 2 },
      scores: { openness: 80, extraversion: 60 },
      personalityType: PersonalityType.CREATIVE,
      additionalNotes: 'Test notes',
    };

    const mockPsychTest = {
      id: 'test-1',
      userId: mockUser.id,
      user: mockUser,
      answers: testData.answers,
      scores: testData.scores,
      personalityType: testData.personalityType,
      additionalNotes: testData.additionalNotes,
      completedAt: new Date(),
    };

    mockUserRepository.findOne.mockResolvedValue(mockUser);
    mockPsychologicalTestRepository.create.mockReturnValue(mockPsychTest);
    mockPsychologicalTestRepository.save.mockResolvedValue(mockPsychTest);

    await userService.saveTestResult(telegramId, testData);

    expect(mockUserRepository.findOne).toHaveBeenCalledWith({
      where: { telegramId },
    });
    expect(mockPsychologicalTestRepository.create).toHaveBeenCalled();
    expect(mockPsychologicalTestRepository.save).toHaveBeenCalledWith(mockPsychTest);
  });

  it('должен получить результат психологического теста', async () => {
    const telegramId = '123123123';
    const mockUser = {
      id: 'user-1',
      telegramId,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
    };

    const mockPsychTest = {
      id: 'test-1',
      userId: mockUser.id,
      user: mockUser,
      answers: { 1: 1, 2: 2 },
      scores: { openness: 80, extraversion: 60 },
      personalityType: PersonalityType.CREATIVE,
      additionalNotes: 'Test notes',
      completedAt: new Date(),
    };

    mockUserRepository.findOne.mockResolvedValue(mockUser);
    mockPsychologicalTestRepository.findOne.mockResolvedValue(mockPsychTest);

    const result = await userService.getTestResult(telegramId);

    expect(result).toBeDefined();
    expect(result.userId).toBe(mockUser.id);
    expect(result.answers).toEqual({ 1: 1, 2: 2 });
    expect(result.scores).toEqual({ openness: 80, extraversion: 60 });
    expect(result.personalityType).toBe(PersonalityType.CREATIVE);
    expect(mockUserRepository.findOne).toHaveBeenCalledWith({
      where: { telegramId },
    });
    expect(mockPsychologicalTestRepository.findOne).toHaveBeenCalledWith({
      where: { userId: mockUser.id },
      order: { createdAt: 'DESC' },
    });
  });
});

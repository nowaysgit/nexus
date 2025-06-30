import { createTestSuite, createTest } from '../../lib/tester';
import { DialogService, DialogMessageType } from '../../src/dialog/services/dialog.service';
import { Dialog } from '../../src/dialog/entities/dialog.entity';
import { Message } from '../../src/dialog/entities/message.entity';
import { Character } from '../../src/character/entities/character.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CacheService } from '../../src/cache/cache.service';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';
import { mockUserService } from '../../lib/tester/mocks/user-service.mock';

// Мок для CacheService
const mockCacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(true),
  clear: jest.fn().mockResolvedValue(undefined),
};

// Создаем моки для репозиториев
const mockDialogRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getManyAndCount: jest.fn(),
  })),
};

const mockMessageRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getManyAndCount: jest.fn(),
  })),
};

const mockCharacterRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getManyAndCount: jest.fn(),
  })),
};

createTestSuite('DialogService Tests', () => {
  let service: DialogService;

  beforeAll(async () => {
    const moduleRef = await TestModuleBuilder.create()
      .withProviders([
        DialogService,
        {
          provide: getRepositoryToken(Dialog),
          useValue: mockDialogRepository,
        },
        {
          provide: getRepositoryToken(Message),
          useValue: mockMessageRepository,
        },
        {
          provide: getRepositoryToken(Character),
          useValue: mockCharacterRepository,
        },
        { provide: 'UserService', useValue: mockUserService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: 'LogService', useClass: MockLogService },
      ])
      .compile();

    service = moduleRef.get<DialogService>(DialogService);

    // Устанавливаем process.env.NODE_ENV для тестового режима
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  createTest(
    {
      name: 'должен быть определен',
    },
    async () => {
      expect(service).toBeDefined();
    },
  );

  createTest(
    {
      name: 'должен создавать диалог с правильными параметрами',
    },
    async () => {
      const mockDialog = {
        id: 1,
        telegramId: '123456789',
        characterId: 1,
        userId: 'test-user-uuid',
        title: null,
        startedAt: new Date(),
        lastMessageAt: new Date(),
        isActive: true,
        lastInteractionDate: new Date(),
        character: null,
        user: null,
        messages: [],
      };

      const mockCharacter = {
        id: 1,
        name: 'Test Character',
      };

      mockCharacterRepository.findOne.mockResolvedValue(mockCharacter as Character);
      mockDialogRepository.findOne.mockResolvedValue(null);
      mockDialogRepository.create.mockReturnValue(mockDialog as Dialog);
      mockDialogRepository.save.mockResolvedValue(mockDialog as Dialog);

      const result = await service.getOrCreateDialog('123456789', 1);

      expect(result).toEqual(mockDialog);
      expect(mockDialogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          telegramId: '123456789',
          characterId: 1,
          isActive: true,
        }),
      );
    },
  );

  createTest(
    {
      name: 'должен возвращать существующий диалог, если он уже существует',
    },
    async () => {
      const mockDialog = {
        id: 1,
        telegramId: '123456789',
        characterId: 1,
        userId: 'test-user-uuid',
        title: null,
        startedAt: new Date(),
        lastMessageAt: new Date(),
        isActive: true,
        lastInteractionDate: null,
        character: null,
        user: null,
        messages: [],
      };

      mockDialogRepository.findOne.mockResolvedValue(mockDialog as Dialog);
      mockDialogRepository.create.mockClear();
      mockDialogRepository.save.mockClear();

      const result = await service.getOrCreateDialog('123456789', 1);

      expect(result).toEqual(mockDialog);
      expect(mockDialogRepository.create).not.toHaveBeenCalled();
      expect(mockDialogRepository.save).not.toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен сохранять сообщения пользователя',
    },
    async () => {
      const mockDialog = {
        id: 1,
        telegramId: '123456789',
        characterId: 1,
        userId: 'test-user-uuid',
        title: null,
        startedAt: new Date(),
        lastMessageAt: new Date(),
        isActive: true,
        lastInteractionDate: null,
        character: null,
        user: null,
        messages: [],
      };

      // Создаем объект сообщения с минимально необходимыми полями
      const now = new Date();
      const mockMessage = {
        id: 1,
        dialogId: 1,
        content: 'Test message',
        isFromUser: true,
        type: DialogMessageType.USER,
        createdAt: now,
        updatedAt: now,
        dialog: mockDialog as Dialog,
        userId: 1,
        user: null,
        characterId: 1,
        character: null,
        metadata: {},
      } as Message;

      // Настраиваем моки для создания сообщения
      mockDialogRepository.findOne.mockResolvedValue(mockDialog as Dialog);
      // В реальной реализации используется new Message() вместо messageRepository.create()
      mockMessageRepository.save.mockResolvedValue(mockMessage);

      const createMessageData = {
        dialogId: 1,
        content: 'Test message',
        type: DialogMessageType.USER,
      };

      const result = await service.createMessage(createMessageData);

      expect(result).toEqual(mockMessage);
      // Проверяем, что был вызван save с объектом, содержащим нужные свойства
      expect(mockMessageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          dialogId: 1,
          content: 'Test message',
          isFromUser: true,
        }),
      );
    },
  );

  createTest(
    {
      name: 'должен получать историю диалога',
    },
    async () => {
      const mockDialog = {
        id: 1,
        telegramId: '123456789',
        characterId: 1,
        userId: 'test-user-uuid',
        title: null,
        startedAt: new Date(),
        lastMessageAt: new Date(),
        isActive: true,
        lastInteractionDate: null,
        character: null,
        user: null,
        messages: [],
      };

      // Создаем массив сообщений с минимально необходимыми полями
      const now = new Date();
      const mockMessages = [
        {
          id: 1,
          dialogId: 1,
          content: 'User message',
          isFromUser: true,
          type: DialogMessageType.USER,
          createdAt: now,
          updatedAt: now,
          dialog: {} as Dialog,
          userId: 1,
          user: null,
          characterId: 1,
          character: null,
          metadata: null,
        } as Message,
        {
          id: 2,
          dialogId: 1,
          content: 'Character message',
          isFromUser: false,
          type: DialogMessageType.CHARACTER,
          createdAt: now,
          updatedAt: now,
          dialog: {} as Dialog,
          userId: 1,
          user: null,
          characterId: 1,
          character: null,
          metadata: null,
        } as Message,
      ];

      // Настраиваем моки для получения истории диалога
      mockDialogRepository.findOne.mockResolvedValue(mockDialog as Dialog);

      // Создаем мок для createQueryBuilder
      const queryBuilderMock = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockMessages),
        getOne: jest.fn(),
        getManyAndCount: jest.fn(),
      };

      // Мокаем метод find для получения сообщений
      mockMessageRepository.find.mockResolvedValue(mockMessages);
      mockMessageRepository.createQueryBuilder.mockReturnValue(queryBuilderMock);

      // Вызываем метод getDialogHistory
      const result = await service.getDialogHistory('123456789', 1);

      // Проверяем результат
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(mockMessages.length);

      // Проверяем содержимое сообщений, если они есть
      if (result.length >= 2) {
        expect(result[0].content).toBe(mockMessages[0].content);
        expect(result[1].content).toBe(mockMessages[1].content);
      }
    },
  );
});

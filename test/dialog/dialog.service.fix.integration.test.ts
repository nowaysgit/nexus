import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { DialogService, DialogMessageType } from '../../src/dialog/services/dialog.service';
import { CacheModule } from '../../src/cache/cache.module';
import { MessageQueueModule } from '../../src/message-queue/message-queue.module';
import { ValidationModule } from '../../src/validation/validation.module';
import { LoggingModule } from '../../src/logging/logging.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Dialog } from '../../src/dialog/entities/dialog.entity';
import { Message } from '../../src/dialog/entities/message.entity';
import { Character } from '../../src/character/entities/character.entity';
import { v4 as uuidv4 } from 'uuid';

// Расширенный мок для UserService
const extendedMockUserService = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
  findByTelegramId: jest.fn(),
  createAccessKey: jest.fn(),
  validateAccessKey: jest.fn(),
  getUserByTelegramId: jest.fn(),
  getUserIdByTelegramId: jest.fn().mockResolvedValue('123'),
};

// Моки репозиториев
const mockDialogRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  manager: {
    connection: {
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn(),
        query: jest.fn(),
        release: jest.fn(),
      }),
    },
  },
};

const mockMessageRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
};

const mockCharacterRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
};

createTestSuite('DialogService Optimized Tests', () => {
  createTest(
    {
      name: 'должен быть определен',
      configType: TestConfigType.BASIC,
      requiresDatabase: false,
      imports: [CacheModule, MessageQueueModule, ValidationModule, LoggingModule],
      providers: [
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
        {
          provide: 'UserService',
          useValue: extendedMockUserService,
        },
      ],
    },
    async testModule => {
      const dialogService = testModule.get<DialogService>(DialogService);
      expect(dialogService).toBeDefined();
    },
  );

  createTest(
    {
      name: 'должен создавать диалог через сервис',
      configType: TestConfigType.BASIC,
      requiresDatabase: false,
      imports: [CacheModule, MessageQueueModule, ValidationModule, LoggingModule],
      providers: [
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
        {
          provide: 'UserService',
          useValue: extendedMockUserService,
        },
      ],
    },
    async testModule => {
      const dialogService = testModule.get<DialogService>(DialogService);

      // Используем UUID формат для telegramId в тестах
      const telegramId = uuidv4();
      const characterId = 1;

      // Настраиваем моки
      const mockDialog = {
        id: 1,
        telegramId,
        characterId,
        userId: '123',
        isActive: true,
        lastInteractionDate: new Date(),
      };

      const mockCharacter = {
        id: characterId,
        name: 'Test Character',
        age: 25,
        isActive: true,
      };

      mockCharacterRepository.findOne.mockResolvedValue(mockCharacter);
      mockDialogRepository.create.mockReturnValue(mockDialog);
      mockDialogRepository.save.mockResolvedValue(mockDialog);
      mockDialogRepository.findOne.mockResolvedValue(null); // Сначала диалог не найден

      // Создаем диалог через сервис
      const dialog = await dialogService.getOrCreateDialog(telegramId, characterId);

      // Проверяем результат
      expect(dialog).toBeDefined();
      expect(dialog).not.toBeNull();
      expect(dialog.telegramId).toBe(telegramId);
      expect(dialog.characterId).toBe(characterId);
      expect(dialog.isActive).toBe(true);

      // Проверяем, что моки были вызваны
      expect(mockCharacterRepository.findOne).toHaveBeenCalledWith({
        where: { id: characterId },
      });
      expect(mockDialogRepository.create).toHaveBeenCalled();
      expect(mockDialogRepository.save).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен находить диалог по telegramId и characterId',
      configType: TestConfigType.BASIC,
      requiresDatabase: false,
      imports: [CacheModule, MessageQueueModule, ValidationModule, LoggingModule],
      providers: [
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
        {
          provide: 'UserService',
          useValue: extendedMockUserService,
        },
      ],
    },
    async testModule => {
      const dialogService = testModule.get<DialogService>(DialogService);

      // Используем UUID формат для telegramId в тестах
      const telegramId = uuidv4();
      const characterId = 1;

      // Настраиваем мок
      const mockDialog = {
        id: 1,
        telegramId,
        characterId,
        userId: '123',
        isActive: true,
        lastInteractionDate: new Date(),
        character: {
          id: characterId,
          name: 'Test Character',
        },
      };

      mockDialogRepository.findOne.mockResolvedValue(mockDialog);

      // Получаем диалог через сервис по telegramId и characterId
      const foundDialog = await dialogService.getDialogByTelegramIdAndCharacterId(
        telegramId,
        characterId,
      );

      expect(foundDialog).toBeDefined();
      expect(foundDialog).not.toBeNull();
      expect(foundDialog.telegramId).toBe(telegramId);
      expect(foundDialog.characterId).toBe(characterId);
      expect(foundDialog.id).toBe(mockDialog.id);

      // Проверяем, что мок был вызван с правильными параметрами
      expect(mockDialogRepository.findOne).toHaveBeenCalledWith({
        where: {
          telegramId,
          characterId,
          isActive: true,
        },
        relations: ['character'],
      });
    },
  );

  createTest(
    {
      name: 'должен создавать сообщения пользователя и персонажа',
      configType: TestConfigType.BASIC,
      requiresDatabase: false,
      imports: [CacheModule, MessageQueueModule, ValidationModule, LoggingModule],
      providers: [
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
        {
          provide: 'UserService',
          useValue: extendedMockUserService,
        },
      ],
    },
    async testModule => {
      const dialogService = testModule.get<DialogService>(DialogService);

      const dialogId = 1;
      const userMessageContent = 'Привет!';
      const characterMessageContent = 'Привет, как дела?';

      // Настраиваем моки
      const mockDialog = {
        id: dialogId,
        telegramId: '123456',
        characterId: 1,
        userId: '123',
        isActive: true,
        lastInteractionDate: new Date(),
      };

      const mockUserMessage = {
        id: 1,
        dialogId,
        content: userMessageContent,
        isFromUser: true,
        createdAt: new Date(),
      };

      const mockCharacterMessage = {
        id: 2,
        dialogId,
        content: characterMessageContent,
        isFromUser: false,
        createdAt: new Date(),
      };

      // Мокаем getDialogById который вызывается в createMessage
      mockDialogRepository.findOne.mockResolvedValue(mockDialog);

      // Мокаем сохранение сообщений
      mockMessageRepository.save.mockResolvedValueOnce(mockUserMessage);
      mockMessageRepository.save.mockResolvedValueOnce(mockCharacterMessage);

      // Мокаем обновление диалога
      mockDialogRepository.save.mockResolvedValue(mockDialog);

      // Создаем сообщение пользователя
      const userMessage = await dialogService.createMessage({
        dialogId,
        content: userMessageContent,
        type: DialogMessageType.USER,
      });

      // Создаем сообщение персонажа
      const characterMessage = await dialogService.createMessage({
        dialogId,
        content: characterMessageContent,
        type: DialogMessageType.CHARACTER,
      });

      // Проверяем, что сообщения созданы
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toBe(userMessageContent);
      expect(userMessage.isFromUser).toBe(true);

      expect(characterMessage).toBeDefined();
      expect(characterMessage.content).toBe(characterMessageContent);
      expect(characterMessage.isFromUser).toBe(false);

      // Проверяем, что моки были вызваны
      expect(mockDialogRepository.findOne).toHaveBeenCalledTimes(2); // getDialogById вызывается 2 раза
      expect(mockMessageRepository.save).toHaveBeenCalledTimes(2);
      expect(mockDialogRepository.save).toHaveBeenCalledTimes(2); // обновление диалога
    },
  );

  createTest(
    {
      name: 'должен получать историю диалога',
      configType: TestConfigType.BASIC,
      requiresDatabase: false,
      imports: [CacheModule, MessageQueueModule, ValidationModule, LoggingModule],
      providers: [
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
        {
          provide: 'UserService',
          useValue: extendedMockUserService,
        },
      ],
    },
    async testModule => {
      const dialogService = testModule.get<DialogService>(DialogService);

      const dialogId = 1;
      const userMessage1Content = 'Привет!';
      const characterMessageContent = 'Привет, как дела?';
      const userMessage2Content = 'У меня все хорошо!';

      // Настраиваем мок для получения сообщений
      const mockMessages = [
        {
          id: 1,
          dialogId,
          content: userMessage1Content,
          isFromUser: true,
          createdAt: new Date(),
        },
        {
          id: 2,
          dialogId,
          content: characterMessageContent,
          isFromUser: false,
          createdAt: new Date(),
        },
        {
          id: 3,
          dialogId,
          content: userMessage2Content,
          isFromUser: true,
          createdAt: new Date(),
        },
      ];

      // В тестовом режиме getDialogMessages возвращает только массив сообщений
      mockMessageRepository.findAndCount.mockResolvedValue([mockMessages, 3]);

      // Получаем историю диалога
      const messagesResult = await dialogService.getDialogMessages(dialogId, 1, 10);
      const messages = messagesResult as Message[]; // В тестах возвращается массив

      // Проверяем, что история получена (в тестах возвращается массив)
      expect(messages).toBeDefined();
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBe(3);
      expect(messages.some((m: Message) => m.content === userMessage1Content)).toBe(true);
      expect(messages.some((m: Message) => m.content === characterMessageContent)).toBe(true);
      expect(messages.some((m: Message) => m.content === userMessage2Content)).toBe(true);

      // Проверяем, что мок был вызван
      expect(mockMessageRepository.findAndCount).toHaveBeenCalledWith({
        where: { dialogId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
    },
  );
});

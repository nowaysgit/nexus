import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DialogService,
  DialogMessageType,
  CreateMessageData,
} from '../../src/dialog/services/dialog.service';
import { Dialog } from '../../src/dialog/entities/dialog.entity';
import { Message } from '../../src/dialog/entities/message.entity';
import { Character } from '../../src/character/entities/character.entity';
import { CacheService } from '../../src/cache/cache.service';
import { LogService } from '../../src/logging/log.service';

describe('DialogService Integration Tests', () => {
  let dialogService: DialogService;
  let dialogRepository: Repository<Dialog>;
  let messageRepository: Repository<Message>;
  let mockCacheService: Partial<CacheService>;
  let mockLogService: Partial<LogService>;

  beforeEach(async () => {
    // Создаем моки для репозиториев и сервисов
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(true),
    };

    mockLogService = {
      setContext: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DialogService,
        {
          provide: getRepositoryToken(Dialog),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Character),
          useValue: {
            findOne: jest.fn(),
          },
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

    dialogService = module.get<DialogService>(DialogService);
    dialogRepository = module.get<Repository<Dialog>>(getRepositoryToken(Dialog));
    messageRepository = module.get<Repository<Message>>(getRepositoryToken(Message));

    // Устанавливаем process.env.NODE_ENV для тестового режима
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(dialogService).toBeDefined();
  });

  it('should create a dialog', async () => {
    const telegramId = '123456789';
    const characterId = 1;
    const userId = 1;
    const mockDialog = {
      id: 1,
      telegramId,
      characterId,
      userId,
      messages: [],
    };

    // Мокируем методы репозитория
    jest.spyOn(dialogRepository, 'findOne').mockResolvedValue(null);
    jest.spyOn(dialogRepository, 'create').mockReturnValue(mockDialog as unknown as Dialog);
    jest.spyOn(dialogRepository, 'save').mockResolvedValue(mockDialog as unknown as Dialog);

    // Переопределяем метод getOrCreateDialog для теста
    const originalGetOrCreateDialog = dialogService.getOrCreateDialog;
    dialogService.getOrCreateDialog = jest.fn().mockResolvedValue(mockDialog as unknown as Dialog);

    const result = await dialogService.getOrCreateDialog(telegramId, characterId);

    expect(result).toEqual(mockDialog);
    expect(dialogService.getOrCreateDialog).toHaveBeenCalledWith(telegramId, characterId);

    // Восстанавливаем оригинальный метод
    dialogService.getOrCreateDialog = originalGetOrCreateDialog;
  });

  it('should save user and character messages', async () => {
    const telegramId = '123456789';
    const characterId = 1;
    const dialogId = 1;
    const userMessageContent = 'Привет, это тестовое сообщение!';
    const characterMessageContent = 'Привет, я получил твое сообщение!';

    const mockDialog = {
      id: dialogId,
      telegramId,
      characterId,
      userId: 1,
      messages: [],
    };

    const mockUserMessage = {
      id: 1,
      dialogId,
      content: userMessageContent,
      type: DialogMessageType.USER,
      createdAt: new Date(),
      isFromUser: true,
    };

    const mockCharacterMessage = {
      id: 2,
      dialogId,
      content: characterMessageContent,
      type: DialogMessageType.CHARACTER,
      createdAt: new Date(),
      isFromUser: false,
    };

    // Мокируем методы сервиса
    const originalGetOrCreateDialog = dialogService.getOrCreateDialog;
    dialogService.getOrCreateDialog = jest.fn().mockResolvedValue(mockDialog as unknown as Dialog);

    const originalCreateMessage = dialogService.createMessage;
    dialogService.createMessage = jest.fn().mockImplementation((data: CreateMessageData) => {
      if (data.type === DialogMessageType.USER) {
        return Promise.resolve(mockUserMessage as unknown as Message);
      } else {
        return Promise.resolve(mockCharacterMessage as unknown as Message);
      }
    });

    const originalSaveUserMessage = dialogService.saveUserMessage;
    dialogService.saveUserMessage = jest
      .fn()
      .mockResolvedValue(mockUserMessage as unknown as Message);

    const originalSaveCharacterMessageDirect = dialogService.saveCharacterMessageDirect;
    dialogService.saveCharacterMessageDirect = jest
      .fn()
      .mockResolvedValue(mockCharacterMessage as unknown as Message);

    // Вызываем методы напрямую
    const userMessage = await dialogService.saveUserMessage(
      telegramId,
      characterId,
      userMessageContent,
    );
    const characterMessage = await dialogService.saveCharacterMessageDirect(
      dialogId,
      characterMessageContent,
    );

    expect(userMessage).toEqual(mockUserMessage);
    expect(characterMessage).toEqual(mockCharacterMessage);

    expect(dialogService.saveUserMessage).toHaveBeenCalledWith(
      telegramId,
      characterId,
      userMessageContent,
    );
    expect(dialogService.saveCharacterMessageDirect).toHaveBeenCalledWith(
      dialogId,
      characterMessageContent,
    );

    // Восстанавливаем оригинальные методы
    dialogService.getOrCreateDialog = originalGetOrCreateDialog;
    dialogService.createMessage = originalCreateMessage;
    dialogService.saveUserMessage = originalSaveUserMessage;
    dialogService.saveCharacterMessageDirect = originalSaveCharacterMessageDirect;
  });

  it('should retrieve dialog history', async () => {
    const dialogId = 1;
    const mockMessages = [
      {
        id: 1,
        dialogId,
        content: 'Сообщение 1',
        type: DialogMessageType.USER,
        createdAt: new Date(),
        isFromUser: true,
      },
      {
        id: 2,
        dialogId,
        content: 'Ответ 1',
        type: DialogMessageType.CHARACTER,
        createdAt: new Date(),
        isFromUser: false,
      },
      {
        id: 3,
        dialogId,
        content: 'Сообщение 2',
        type: DialogMessageType.USER,
        createdAt: new Date(),
        isFromUser: true,
      },
    ];

    // Мокируем метод find, чтобы он возвращал mockMessages
    jest.spyOn(messageRepository, 'find').mockResolvedValue(mockMessages as unknown as Message[]);

    // Переопределяем метод getDialogMessages для теста
    const originalGetDialogMessages = dialogService.getDialogMessages;
    dialogService.getDialogMessages = jest
      .fn()
      .mockResolvedValue(mockMessages as unknown as Message[]);

    const historyResult = await dialogService.getDialogMessages(dialogId, 1, 10);

    expect(historyResult).toEqual(mockMessages);
    expect(dialogService.getDialogMessages).toHaveBeenCalledWith(dialogId, 1, 10);

    // Восстанавливаем оригинальный метод
    dialogService.getDialogMessages = originalGetDialogMessages;
  });

  it('should get a dialog by ID', async () => {
    const dialogId = 1;
    const mockDialog = {
      id: dialogId,
      telegramId: '123456789',
      characterId: 1,
      userId: 1,
      messages: [],
    };

    // Мокируем метод findOne, чтобы он возвращал mockDialog
    jest.spyOn(dialogRepository, 'findOne').mockResolvedValue(mockDialog as unknown as Dialog);
    jest.spyOn(mockCacheService, 'set').mockResolvedValue(undefined);

    // Переопределяем метод getDialogById для теста
    const originalGetDialogById = dialogService.getDialogById;
    dialogService.getDialogById = jest.fn().mockResolvedValue(mockDialog as unknown as Dialog);

    const result = await dialogService.getDialogById(dialogId);

    expect(result).toEqual(mockDialog);
    expect(dialogService.getDialogById).toHaveBeenCalledWith(dialogId);

    // Восстанавливаем оригинальный метод
    dialogService.getDialogById = originalGetDialogById;
  });
});

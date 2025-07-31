import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DialogService, DialogMessageType } from '../../../src/dialog/services/dialog.service';
import { Dialog } from '../../../src/dialog/entities/dialog.entity';
import { Message } from '../../../src/dialog/entities/message.entity';
import { Character, CharacterGender } from '../../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';
import { CacheService } from '../../../src/cache/cache.service';
import { LogService } from '../../../src/logging/log.service';

describe('DialogService', () => {
  let service: DialogService;
  let dialogRepository: jest.Mocked<Repository<Dialog>>;
  let messageRepository: jest.Mocked<Repository<Message>>;
  let characterRepository: jest.Mocked<Repository<Character>>;
  let cacheService: jest.Mocked<CacheService>;
  let logService: jest.Mocked<LogService>;

  const mockDialog: Partial<Dialog> = {
    id: 1,
    telegramId: '12345',
    characterId: 1,
    isActive: true,
    lastMessageAt: new Date(),
  };

  const mockMessage: Partial<Message> = {
    id: 1,
    dialogId: 1,
    content: 'Test message',
    isFromUser: true,
    createdAt: new Date(),
  };

  const _mockCharacter: Partial<Character> = {
    id: 1,
    name: 'Test Character',
  };

  const createMockCharacter = (): Partial<Character> => ({
    id: 1,
    name: 'Test Character',
    fullName: 'Test Character Full',
    age: 25,
    gender: CharacterGender.FEMALE,
    archetype: CharacterArchetype.COMPANION,
    biography: 'Test biography',
    appearance: 'Test appearance',
    personality: {
      traits: ['friendly'],
      hobbies: ['reading'],
      fears: ['spiders'],
      values: ['honesty'],
      musicTaste: ['pop'],
      strengths: ['empathy'],
      weaknesses: ['impatience'],
    },
  });

  beforeEach(async () => {
    const mockDialogRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      })),
    };

    const mockMessageRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
        getOne: jest.fn(),
      })),
    };

    const mockCharacterRepository = {
      findOne: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn(),
    };

    const mockLogService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
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
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    }).compile();

    service = module.get<DialogService>(DialogService);
    dialogRepository = module.get(getRepositoryToken(Dialog));
    messageRepository = module.get(getRepositoryToken(Message));
    characterRepository = module.get(getRepositoryToken(Character));
    cacheService = module.get(CacheService);
    logService = module.get(LogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('создание сервиса', () => {
    it('должен быть создан', () => {
      expect(service).toBeDefined();
    });

    it('должен расширять BaseService', () => {
      expect(service).toBeInstanceOf(DialogService);
      expect(service['logService']).toBe(logService);
    });
  });

  describe('getOrCreateDialog', () => {
    it('должен возвращать существующий диалог из кэша', async () => {
      const cachedDialog = { ...mockDialog };
      cacheService.get.mockResolvedValue(cachedDialog as Dialog);

      const result = await service.getOrCreateDialog('12345', 1);

      expect(result).toEqual(cachedDialog);
      expect(cacheService.get).toHaveBeenCalledWith('dialog:12345:1');
      expect(dialogRepository.findOne).not.toHaveBeenCalled();
    });

    it('должен возвращать существующий диалог из БД если кэш пуст', async () => {
      cacheService.get.mockResolvedValue(null);
      dialogRepository.findOne.mockResolvedValue(mockDialog as Dialog);

      const result = await service.getOrCreateDialog('12345', 1);

      expect(result).toEqual(mockDialog);
      expect(dialogRepository.findOne).toHaveBeenCalledWith({
        where: { telegramId: '12345', characterId: 1, isActive: true },
        relations: ['character'],
      });
      expect(cacheService.set).toHaveBeenCalledWith('dialog:12345:1', mockDialog, 300);
    });

    it('должен создавать новый диалог если не найден', async () => {
      const mockCharacter = createMockCharacter();
      cacheService.get.mockResolvedValue(null);
      dialogRepository.findOne.mockResolvedValue(null);
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
      dialogRepository.create.mockReturnValue(mockDialog as Dialog);
      dialogRepository.save.mockResolvedValue(mockDialog as Dialog);

      const result = await service.getOrCreateDialog('12345', 1);

      expect(result).toEqual(mockDialog);
      expect(characterRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(dialogRepository.save).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalledWith('dialog:12345:1', mockDialog, 300);
    });

    it('должен работать с числовым telegramId', async () => {
      cacheService.get.mockResolvedValue(null);
      dialogRepository.findOne.mockResolvedValue(mockDialog as Dialog);

      await service.getOrCreateDialog(12345, 1);

      expect(cacheService.get).toHaveBeenCalledWith('dialog:12345:1');
      expect(dialogRepository.findOne).toHaveBeenCalledWith({
        where: { telegramId: '12345', characterId: 1, isActive: true },
        relations: ['character'],
      });
    });
  });

  describe('createMessage', () => {
    it('должен создавать новое сообщение', async () => {
      const messageData = {
        dialogId: 1,
        content: 'Test message',
        type: DialogMessageType.USER,
      };

      dialogRepository.findOne.mockResolvedValue(mockDialog as Dialog);
      messageRepository.save.mockResolvedValue(mockMessage as Message);

      const result = await service.createMessage(messageData);

      expect(result).toEqual(mockMessage);
      expect(messageRepository.save).toHaveBeenCalled();
    });

    it('должен создавать сообщение с метаданными', async () => {
      const messageData = {
        dialogId: 1,
        content: 'Test message',
        type: DialogMessageType.CHARACTER,
        metadata: { isProactive: true, actionType: 'greeting' },
      };

      dialogRepository.findOne.mockResolvedValue(mockDialog as Dialog);
      messageRepository.save.mockResolvedValue(mockMessage as Message);

      const result = await service.createMessage(messageData);

      expect(result).toEqual(mockMessage);
      expect(messageRepository.save).toHaveBeenCalled();
    });

    it('должен выбрасывать ошибку если диалог не найден', async () => {
      const messageData = {
        dialogId: 999,
        content: 'Test message',
        type: DialogMessageType.USER,
      };

      dialogRepository.findOne.mockResolvedValue(null);

      await expect(service.createMessage(messageData)).rejects.toThrow('Диалог с ID 999 не найден');
    });
  });

  describe('getDialogHistory', () => {
    const mockMessages = [
      { ...mockMessage, id: 1, content: 'Message 1' },
      { ...mockMessage, id: 2, content: 'Message 2' },
    ];

    beforeEach(() => {
      cacheService.get.mockResolvedValue(null);
      dialogRepository.findOne.mockResolvedValue(mockDialog as Dialog);
      messageRepository.find.mockResolvedValue(mockMessages as Message[]);
    });

    it('должен возвращать историю диалога с лимитом по умолчанию', async () => {
      const result = await service.getDialogHistory('12345', 1);

      expect(result).toEqual(mockMessages);
      expect(messageRepository.find).toHaveBeenCalledWith({
        where: { dialogId: 1 },
        order: { createdAt: 'DESC' },
        take: 20,
      });
    });

    it('должен возвращать историю диалога с указанным лимитом', async () => {
      const result = await service.getDialogHistory('12345', 1, 5);

      expect(result).toEqual(mockMessages);
      expect(messageRepository.find).toHaveBeenCalledWith({
        where: { dialogId: 1 },
        order: { createdAt: 'DESC' },
        take: 5,
      });
    });
  });

  describe('getUserDialogs', () => {
    const mockDialogs = [
      { ...mockDialog, id: 1, characterId: 1 },
      { ...mockDialog, id: 2, characterId: 2 },
    ];

    beforeEach(() => {
      dialogRepository.find.mockResolvedValue(mockDialogs as Dialog[]);
    });

    it('должен возвращать диалоги пользователя', async () => {
      const result = await service.getUserDialogs('12345');

      expect(result).toEqual(mockDialogs);
      expect(dialogRepository.find).toHaveBeenCalledWith({
        where: {
          telegramId: '12345',
          isActive: true,
        },
        relations: ['character'],
        order: {
          lastInteractionDate: 'DESC',
        },
      });
    });
  });

  describe('sendMessage', () => {
    it('должен отправлять сообщение пользователю', async () => {
      await service.sendMessage('12345', 'Test message');

      expect(logService.debug).toHaveBeenCalledWith('Сообщение сохранено в диалог', {
        chatId: '12345',
        messageLength: 12,
        options: undefined,
      });
    });

    it('должен отправлять сообщение с дополнительными параметрами', async () => {
      const mockCharacter = createMockCharacter();
      const options = { characterId: 1, isProactive: true };

      cacheService.get.mockResolvedValue(null);
      dialogRepository.findOne.mockResolvedValue(mockDialog as Dialog);
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
      messageRepository.save.mockResolvedValue(mockMessage as Message);

      await service.sendMessage('12345', 'Test message', options);

      expect(logService.debug).toHaveBeenCalledWith('Сообщение сохранено в диалог', {
        chatId: '12345',
        messageLength: 12,
        options,
      });
    });
  });

  describe('getDialogById', () => {
    it('должен возвращать диалог из кэша', async () => {
      const cachedDialog = { ...mockDialog };
      cacheService.get.mockResolvedValue(cachedDialog as Dialog);

      const result = await service.getDialogById(1);

      expect(result).toEqual(cachedDialog);
      expect(cacheService.get).toHaveBeenCalledWith('dialog:id:1');
    });

    it('должен возвращать диалог из БД если кэш пуст', async () => {
      cacheService.get.mockResolvedValue(null);
      dialogRepository.findOne.mockResolvedValue(mockDialog as Dialog);

      const result = await service.getDialogById(1);

      expect(result).toEqual(mockDialog);
      expect(dialogRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(cacheService.set).toHaveBeenCalledWith('dialog:id:1', mockDialog, 300);
    });

    it('должен работать со строковым ID', async () => {
      cacheService.get.mockResolvedValue(null);
      dialogRepository.findOne.mockResolvedValue(mockDialog as Dialog);

      const result = await service.getDialogById('1');

      expect(result).toEqual(mockDialog);
      expect(dialogRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });

  describe('deleteDialog', () => {
    it('должен удалять диалог и его сообщения', async () => {
      const deleteResult = { affected: 5, raw: {} };
      messageRepository.delete.mockResolvedValue(deleteResult);
      dialogRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

      const result = await service.deleteDialog(1);

      expect(result).toBe(true);
      expect(messageRepository.delete).toHaveBeenCalledWith({ dialogId: 1 });
      expect(dialogRepository.delete).toHaveBeenCalledWith(1);
    });

    it('должен возвращать false если диалог не найден', async () => {
      messageRepository.delete.mockResolvedValue({ affected: 0, raw: {} });
      dialogRepository.delete.mockResolvedValue({ affected: 0, raw: {} });

      const result = await service.deleteDialog(999);

      expect(result).toBe(false);
    });
  });

  describe('обработка ошибок', () => {
    it('должен обрабатывать ошибки при getOrCreateDialog', async () => {
      cacheService.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.getOrCreateDialog('12345', 1)).rejects.toThrow();
      expect(logService.error).toHaveBeenCalled();
    });

    it('должен обрабатывать ошибки при createMessage', async () => {
      dialogRepository.findOne.mockRejectedValue(new Error('Database error'));

      const messageData = {
        dialogId: 1,
        content: 'Test message',
        type: DialogMessageType.USER,
      };

      await expect(service.createMessage(messageData)).rejects.toThrow();
      expect(logService.error).toHaveBeenCalled();
    });

    it('должен обрабатывать ошибки при getDialogHistory', async () => {
      cacheService.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.getDialogHistory('12345', 1)).rejects.toThrow();
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe('интеграция с кэшем', () => {
    it('должен сохранять диалог в кэш при создании', async () => {
      const mockCharacter = createMockCharacter();
      cacheService.get.mockResolvedValue(null);
      dialogRepository.findOne.mockResolvedValue(null);
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
      dialogRepository.create.mockReturnValue(mockDialog as Dialog);
      dialogRepository.save.mockResolvedValue(mockDialog as Dialog);

      await service.getOrCreateDialog('12345', 1);

      expect(cacheService.set).toHaveBeenCalledWith('dialog:12345:1', mockDialog, 300);
    });

    it('должен корректно работать при ошибках кэша', async () => {
      cacheService.get.mockRejectedValue(new Error('Cache error'));
      dialogRepository.findOne.mockResolvedValue(mockDialog as Dialog);

      await expect(service.getOrCreateDialog('12345', 1)).rejects.toThrow();
      expect(logService.error).toHaveBeenCalled();
    });
  });
});

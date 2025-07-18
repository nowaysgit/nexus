import { DialogService } from '../../../src/dialog/services/dialog.service';
import { Dialog } from '../../../src/dialog/entities/dialog.entity';
import { Message } from '../../../src/dialog/entities/message.entity';
import { Character } from '../../../src/character/entities/character.entity';
import { CacheService } from '../../../src/cache/cache.service';
import { LogService } from '../../../src/logging/log.service';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

describe('DialogService', () => {
  let service: DialogService;
  let mockDialogRepository: jest.Mocked<Repository<Dialog>>;
  let mockMessageRepository: jest.Mocked<Repository<Message>>;
  let mockCharacterRepository: jest.Mocked<Repository<Character>>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockLogService: jest.Mocked<LogService>;
  let mockUserService: any;

  beforeEach(() => {
    mockDialogRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      manager: {
        connection: {
          createQueryRunner: jest.fn(),
        },
      },
    } as any;

    mockMessageRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockCharacterRepository = {
      findOne: jest.fn(),
    } as any;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn(),
    } as any;

    mockLogService = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    mockUserService = {
      getUserIdByTelegramId: jest.fn(),
    };

    service = new DialogService(
      mockDialogRepository,
      mockMessageRepository,
      mockCharacterRepository,
      mockCacheService,
      mockLogService,
      mockUserService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateDialog', () => {
    it('should return cached dialog if exists', async () => {
      const cachedDialog = { id: 1, telegramId: '123', characterId: 1 } as Dialog;
      mockCacheService.get.mockResolvedValue(cachedDialog);

      const result = await service.getOrCreateDialog('123', 1);

      expect(result).toBe(cachedDialog);
      expect(mockCacheService.get).toHaveBeenCalledWith('dialog:123:1');
      expect(mockDialogRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return existing dialog from database', async () => {
      const existingDialog = { id: 1, telegramId: '123', characterId: 1 } as Dialog;
      mockCacheService.get.mockResolvedValue(null);
      mockDialogRepository.findOne.mockResolvedValue(existingDialog);

      const result = await service.getOrCreateDialog('123', 1);

      expect(result).toBe(existingDialog);
      expect(mockDialogRepository.findOne).toHaveBeenCalledWith({
        where: { telegramId: '123', characterId: 1, isActive: true },
        relations: ['character'],
      });
      expect(mockCacheService.set).toHaveBeenCalledWith('dialog:123:1', existingDialog, 300);
    });

    it('should create new dialog if not exists', async () => {
      const character = { id: 1, name: 'Test Character' } as Character;
      const newDialog = { id: 2, telegramId: '123', characterId: 1 } as Dialog;

      mockCacheService.get.mockResolvedValue(null);
      mockDialogRepository.findOne.mockResolvedValue(null);
      mockCharacterRepository.findOne.mockResolvedValue(character);
      mockUserService.getUserIdByTelegramId.mockResolvedValue('456');
      mockDialogRepository.create.mockReturnValue(newDialog);
      mockDialogRepository.save.mockResolvedValue(newDialog);

      const result = await service.getOrCreateDialog('123', 1);

      expect(result).toBe(newDialog);
      expect(mockCharacterRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockUserService.getUserIdByTelegramId).toHaveBeenCalledWith('123');
      expect(mockDialogRepository.create).toHaveBeenCalledWith({
        telegramId: '123',
        characterId: 1,
        character,
        userId: '456',
        isActive: true,
        lastInteractionDate: expect.any(Date),
      });
      expect(mockDialogRepository.save).toHaveBeenCalledWith(newDialog);
      expect(mockCacheService.set).toHaveBeenCalledWith('dialog:123:1', newDialog, 300);
    });

    it('should throw NotFoundException if character not found', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockDialogRepository.findOne.mockResolvedValue(null);
      mockCharacterRepository.findOne.mockResolvedValue(null);

      await expect(service.getOrCreateDialog('123', 1)).rejects.toThrow(NotFoundException);
      expect(mockCharacterRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should handle numeric telegramId', async () => {
      const cachedDialog = { id: 1, telegramId: '123', characterId: 1 } as Dialog;
      mockCacheService.get.mockResolvedValue(cachedDialog);

      const result = await service.getOrCreateDialog(123, 1);

      expect(result).toBe(cachedDialog);
      expect(mockCacheService.get).toHaveBeenCalledWith('dialog:123:1');
    });
  });

  describe('getDialogById', () => {
    it('should return cached dialog if exists', async () => {
      const cachedDialog = { id: 1, telegramId: '123', characterId: 1 } as Dialog;
      mockCacheService.get.mockResolvedValue(cachedDialog);

      const result = await service.getDialogById(1);

      expect(result).toBe(cachedDialog);
      expect(mockCacheService.get).toHaveBeenCalledWith('dialog:id:1');
      expect(mockDialogRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return dialog from database', async () => {
      const dialog = { id: 1, telegramId: '123', characterId: 1 } as Dialog;
      mockCacheService.get.mockResolvedValue(null);
      mockDialogRepository.findOne.mockResolvedValue(dialog);

      const result = await service.getDialogById(1);

      expect(result).toBe(dialog);
      expect(mockDialogRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockCacheService.set).toHaveBeenCalledWith('dialog:id:1', dialog, 300);
    });

    it('should return null if dialog not found', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockDialogRepository.findOne.mockResolvedValue(null);

      const result = await service.getDialogById(1);

      expect(result).toBeNull();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('should handle string dialogId', async () => {
      const dialog = { id: 1, telegramId: '123', characterId: 1 } as Dialog;
      mockCacheService.get.mockResolvedValue(null);
      mockDialogRepository.findOne.mockResolvedValue(dialog);

      const result = await service.getDialogById('1');

      expect(result).toBe(dialog);
      expect(mockDialogRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('findActiveDialogByParticipants', () => {
    it('should find active dialog by participants', async () => {
      const dialog = { id: 1, telegramId: '123', characterId: 1, isActive: true } as Dialog;
      mockDialogRepository.findOne.mockResolvedValue(dialog);

      const result = await service.findActiveDialogByParticipants(1, '123');

      expect(result).toBe(dialog);
      expect(mockDialogRepository.findOne).toHaveBeenCalledWith({
        where: { characterId: 1, telegramId: '123', isActive: true },
        relations: ['character'],
      });
    });

    it('should return null if no active dialog found', async () => {
      mockDialogRepository.findOne.mockResolvedValue(null);

      const result = await service.findActiveDialogByParticipants(1, '123');

      expect(result).toBeNull();
    });
  });

  describe('dialogExists', () => {
    it('should return true if dialog exists', async () => {
      mockDialogRepository.count.mockResolvedValue(1);

      const result = await service.dialogExists(1);

      expect(result).toBe(true);
      expect(mockDialogRepository.count).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should return false if dialog does not exist', async () => {
      mockDialogRepository.count.mockResolvedValue(0);

      const result = await service.dialogExists(1);

      expect(result).toBe(false);
    });
  });

  describe('deleteDialog', () => {
    it('should delete dialog and clear cache', async () => {
      mockMessageRepository.delete.mockResolvedValue({ affected: 5 } as any);
      mockDialogRepository.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await service.deleteDialog(1);

      expect(result).toBe(true);
      expect(mockMessageRepository.delete).toHaveBeenCalledWith({ dialogId: 1 });
      expect(mockDialogRepository.delete).toHaveBeenCalledWith(1);
      expect(mockCacheService.clear).toHaveBeenCalled();
    });

    it('should return false if dialog was not deleted', async () => {
      mockMessageRepository.delete.mockResolvedValue({ affected: 0 } as any);
      mockDialogRepository.delete.mockResolvedValue({ affected: 0 } as any);

      const result = await service.deleteDialog(1);

      expect(result).toBe(false);
    });
  });

  describe('createMessage', () => {
    it('should create message successfully', async () => {
      const dialog = { id: 1, telegramId: '123', characterId: 1 } as Dialog;
      const message = { id: 1, content: 'Test message', dialogId: 1 } as Message;

      mockDialogRepository.findOne.mockResolvedValue(dialog);
      mockMessageRepository.save.mockResolvedValue(message);
      mockDialogRepository.save.mockResolvedValue(dialog);

      const result = await service.createMessage({
        dialogId: 1,
        content: 'Test message',
        type: 'user' as any,
      });

      expect(result).toBe(message);
      expect(mockMessageRepository.save).toHaveBeenCalled();
      expect(mockDialogRepository.save).toHaveBeenCalledWith(dialog);
      expect(mockCacheService.clear).toHaveBeenCalled();
    });

    it('should throw error if dialog not found', async () => {
      mockDialogRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createMessage({
          dialogId: 1,
          content: 'Test message',
          type: 'user' as any,
        }),
      ).rejects.toThrow('Диалог с ID 1 не найден');
    });
  });

  describe('getUserDialogs', () => {
    it('should return user dialogs', async () => {
      const dialogs = [
        { id: 1, telegramId: '123', characterId: 1, isActive: true },
        { id: 2, telegramId: '123', characterId: 2, isActive: true },
      ] as Dialog[];

      mockDialogRepository.find.mockResolvedValue(dialogs);

      const result = await service.getUserDialogs('123');

      expect(result).toBe(dialogs);
      expect(mockDialogRepository.find).toHaveBeenCalledWith({
        where: { telegramId: '123', isActive: true },
        relations: ['character'],
        order: { lastInteractionDate: 'DESC' },
      });
    });
  });

  describe('getCharacterDialogs', () => {
    it('should return character dialogs', async () => {
      const dialogs = [
        { id: 1, telegramId: '123', characterId: 1, isActive: true },
        { id: 2, telegramId: '456', characterId: 1, isActive: true },
      ] as Dialog[];

      mockDialogRepository.find.mockResolvedValue(dialogs);

      const result = await service.getCharacterDialogs(1);

      expect(result).toBe(dialogs);
      expect(mockDialogRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1, isActive: true },
        relations: ['character'],
        order: { lastInteractionDate: 'DESC' },
      });
    });
  });

  describe('getDialogMessages', () => {
    it('should return messages array in test mode', async () => {
      const messages = [
        { id: 1, content: 'Message 1', dialogId: 1 },
        { id: 2, content: 'Message 2', dialogId: 1 },
      ] as Message[];

      mockMessageRepository.findAndCount.mockResolvedValue([messages, 2]);

      const result = await service.getDialogMessages(1, 1, 10);

      expect(result).toBe(messages);
      expect(mockMessageRepository.findAndCount).toHaveBeenCalledWith({
        where: { dialogId: 1 },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
    });
  });

  describe('resetCache', () => {
    it('should clear cache and log debug message', async () => {
      await service.resetCache();

      expect(mockCacheService.clear).toHaveBeenCalled();
      expect(mockLogService.debug).toHaveBeenCalledWith('Кэш диалогов очищен');
    });
  });

  describe('getCacheStats', () => {
    it('should return cache stats with timeout', async () => {
      const stats = {
        hits: 10,
        misses: 5,
        size: 15,
        hitRate: 66.67,
        totalRequests: 15,
        createdAt: new Date(),
      };
      mockCacheService.getStats.mockResolvedValue(stats);

      const result = await service.getCacheStats();

      expect(result).toEqual({
        ...stats,
        cacheTimeout: 300000, // 5 minutes in milliseconds
      });
    });
  });
});

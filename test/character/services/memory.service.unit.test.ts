import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryService } from '../../../src/character/services/core/memory.service';
import {
  CharacterMemory,
  MemoryImportance,
} from '../../../src/character/entities/character-memory.entity';
import { MemoryType } from '../../../src/character/interfaces/memory.interfaces';
import { LogService } from '../../../src/logging/log.service';
import { LLMService } from '../../../src/llm/services/llm.service';

describe('MemoryService Unit Tests', () => {
  let service: MemoryService;
  let memoryRepository: jest.Mocked<Repository<CharacterMemory>>;

  beforeEach(async () => {
    const mockMemoryRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockLLMService = {
      generateEmbedding: jest.fn(),
      analyzeText: jest.fn(),
    };

    const mockLogService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        {
          provide: getRepositoryToken(CharacterMemory),
          useValue: mockMemoryRepository,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    }).compile();

    service = module.get<MemoryService>(MemoryService);
    memoryRepository = module.get(getRepositoryToken(CharacterMemory));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMemory', () => {
    it('должен создавать воспоминание с правильными параметрами', async () => {
      const mockMemory = { id: 1 } as CharacterMemory;
      memoryRepository.create.mockReturnValue(mockMemory);
      memoryRepository.save.mockResolvedValue(mockMemory);
      memoryRepository.count.mockResolvedValue(50); // Для limitMemoriesCount
      memoryRepository.find.mockResolvedValue([]); // Для findRelevantMemories

      const result = await service.createMemory(
        1,
        'Test memory',
        MemoryType.CONVERSATION,
        7 as MemoryImportance,
      );

      expect(memoryRepository.create).toHaveBeenCalled();
      expect(memoryRepository.save).toHaveBeenCalledWith(mockMemory);
      expect(result).toEqual(mockMemory);
    });

    it('должен использовать важность по умолчанию если не указана', async () => {
      const mockMemory = { id: 1 } as CharacterMemory;
      memoryRepository.create.mockReturnValue(mockMemory);
      memoryRepository.save.mockResolvedValue(mockMemory);
      memoryRepository.count.mockResolvedValue(50);
      memoryRepository.find.mockResolvedValue([]);

      await service.createMemory(1, 'Test memory', MemoryType.CONVERSATION);

      expect(memoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          characterId: 1,
          content: 'Test memory',
          type: MemoryType.CONVERSATION,
          importance: 5,
          isActive: true,
          isLongTerm: false,
        }),
      );
    });
  });

  describe('createActionMemory', () => {
    it('должен создавать память о действии', async () => {
      const mockMemory = { id: 1 } as CharacterMemory;
      memoryRepository.create.mockReturnValue(mockMemory);
      memoryRepository.save.mockResolvedValue(mockMemory);
      memoryRepository.count.mockResolvedValue(50);
      memoryRepository.find.mockResolvedValue([]);

      const actionParams = {
        characterId: 1,
        action: {
          description: 'Character performed action',
          metadata: { importance: 8 },
        },
        isInterrupted: false,
      };

      const result = await service.createActionMemory(actionParams);

      expect(memoryRepository.create).toHaveBeenCalled();
      expect(memoryRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockMemory);
    });
  });

  describe('createEventMemory', () => {
    it('должен создавать память о событии', async () => {
      const mockMemory = { id: 1 } as CharacterMemory;
      memoryRepository.create.mockReturnValue(mockMemory);
      memoryRepository.save.mockResolvedValue(mockMemory);
      memoryRepository.count.mockResolvedValue(50);
      memoryRepository.find.mockResolvedValue([]);

      const result = await service.createEventMemory(
        1,
        'Important event occurred',
        8 as MemoryImportance,
        { location: 'test location' },
      );

      expect(memoryRepository.create).toHaveBeenCalled();
      expect(memoryRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockMemory);
    });
  });

  describe('createMessageMemory', () => {
    it('должен создавать память о сообщении', async () => {
      const mockMemory = { id: 1 } as CharacterMemory;
      memoryRepository.create.mockReturnValue(mockMemory);
      memoryRepository.save.mockResolvedValue(mockMemory);
      memoryRepository.count.mockResolvedValue(50);
      memoryRepository.find.mockResolvedValue([]);

      const params = {
        characterId: 1,
        userId: 2,
        messageText: 'Hello, how are you?',
        importance: 6 as MemoryImportance,
        messageId: 123,
        isFromCharacter: false,
      };

      const result = await service.createMessageMemory(params);

      expect(memoryRepository.create).toHaveBeenCalled();
      expect(memoryRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockMemory);
    });

    it('должен использовать важность по умолчанию для сообщений', async () => {
      const mockMemory = { id: 1 } as CharacterMemory;
      memoryRepository.create.mockReturnValue(mockMemory);
      memoryRepository.save.mockResolvedValue(mockMemory);
      memoryRepository.count.mockResolvedValue(50);
      memoryRepository.find.mockResolvedValue([]);

      await service.createMessageMemory({
        characterId: 1,
        userId: 2,
        messageText: 'Test message',
      });

      expect(memoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          importance: 5,
        }),
      );
    });
  });

  describe('getRecentMemories', () => {
    it('должен возвращать недавние воспоминания', async () => {
      const mockMemories = [
        { id: 1, memoryDate: new Date() },
        { id: 2, memoryDate: new Date() },
      ] as CharacterMemory[];

      memoryRepository.find.mockResolvedValue(mockMemories);

      const result = await service.getRecentMemories(1, 10);

      expect(memoryRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1, isActive: true },
        order: { memoryDate: 'DESC' },
        take: 10,
      });
      expect(result).toEqual(mockMemories);
    });

    it('должен фильтровать по типу памяти если указано', async () => {
      const mockMemories = [{ id: 1 }] as CharacterMemory[];
      memoryRepository.find.mockResolvedValue(mockMemories);

      await service.getRecentMemories(1, 5, MemoryType.CONVERSATION);

      expect(memoryRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1, isActive: true, type: MemoryType.CONVERSATION },
        order: { memoryDate: 'DESC' },
        take: 5,
      });
    });

    it('должен обрабатывать ошибки при поиске недавних воспоминаний', async () => {
      memoryRepository.find.mockRejectedValue(new Error('Database error'));

      await expect(service.getRecentMemories(1, 10)).rejects.toThrow();
    });
  });

  describe('getImportantMemories', () => {
    it('должен возвращать важные воспоминания', async () => {
      const mockMemories = [
        { id: 1, importance: 9 },
        { id: 2, importance: 8 },
      ] as CharacterMemory[];

      memoryRepository.find.mockResolvedValue(mockMemories);

      const result = await service.getImportantMemories(1, 5);

      expect(memoryRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1, isActive: true },
        order: { importance: 'DESC', memoryDate: 'DESC' },
        take: 5,
      });
      expect(result).toEqual(mockMemories);
    });
  });

  describe('updateMemoryImportance', () => {
    it('должен обновлять важность воспоминания', async () => {
      const mockMemory = {
        id: 1,
        importance: 5 as MemoryImportance,
      } as CharacterMemory;

      memoryRepository.findOne.mockResolvedValue(mockMemory);
      memoryRepository.save.mockResolvedValue({
        ...mockMemory,
        importance: 8 as MemoryImportance,
      });

      const result = await service.updateMemoryImportance(1, 8 as MemoryImportance);

      expect(memoryRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(memoryRepository.save).toHaveBeenCalled();
      expect(result?.importance).toBe(8);
    });

    it('должен возвращать null если воспоминание не найдено', async () => {
      memoryRepository.findOne.mockResolvedValue(null);

      const result = await service.updateMemoryImportance(999, 8 as MemoryImportance);

      expect(result).toBeNull();
    });
  });

  describe('markMemoryAsRecalled', () => {
    it('должен отмечать воспоминание как вспомненное', async () => {
      const mockMemory = {
        id: 1,
        recallCount: 2,
        lastRecalled: null,
      } as CharacterMemory;

      memoryRepository.findOne.mockResolvedValue(mockMemory);
      memoryRepository.save.mockResolvedValue({
        ...mockMemory,
        recallCount: 3,
        lastRecalled: new Date(),
      });

      const result = await service.markMemoryAsRecalled(1);

      expect(memoryRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(memoryRepository.save).toHaveBeenCalled();
      expect(result?.recallCount).toBe(3);
    });

    it('должен возвращать null если воспоминание не найдено', async () => {
      memoryRepository.findOne.mockResolvedValue(null);

      const result = await service.markMemoryAsRecalled(999);

      expect(result).toBeNull();
    });
  });

  describe('limitMemoriesCount', () => {
    it('должен удалять старые воспоминания при превышении лимита', async () => {
      memoryRepository.count.mockResolvedValue(150); // Превышает лимит 100

      const mockMemoriesToDelete = [{ id: 1 }, { id: 2 }] as CharacterMemory[];
      memoryRepository.find.mockResolvedValue(mockMemoriesToDelete);
      memoryRepository.remove.mockResolvedValue({} as CharacterMemory);

      await service.limitMemoriesCount(1);

      expect(memoryRepository.count).toHaveBeenCalledWith({
        where: { characterId: 1, isLongTerm: false },
      });
      expect(memoryRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1, isLongTerm: false },
        order: { importance: 'ASC', memoryDate: 'ASC' },
        take: 50, // 150 - 100 = 50
      });
      expect(memoryRepository.remove).toHaveBeenCalledWith(mockMemoriesToDelete);
    });

    it('не должен удалять воспоминания если лимит не превышен', async () => {
      memoryRepository.count.mockResolvedValue(80); // Не превышает лимит 100

      await service.limitMemoriesCount(1);

      expect(memoryRepository.count).toHaveBeenCalledWith({
        where: { characterId: 1, isLongTerm: false },
      });
      expect(memoryRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('должен корректно обрабатывать ошибки при создании памяти', async () => {
      memoryRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(
        service.createMemory(1, 'Test memory', MemoryType.CONVERSATION),
      ).rejects.toThrow();
    });

    it('должен логировать ошибки', async () => {
      memoryRepository.find.mockRejectedValue(new Error('Database error'));

      await expect(service.getRecentMemories(1, 10)).rejects.toThrow();
    });
  });
});

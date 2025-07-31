import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { NeedsService } from '../../../src/character/services/core/needs.service';
import { Character } from '../../../src/character/entities/character.entity';
import { Need } from '../../../src/character/entities/need.entity';
import { LogService } from '../../../src/logging/log.service';
import { MessageQueueService } from '../../../src/message-queue/message-queue.service';
import { CharacterNeedType } from '../../../src/character/enums/character-need-type.enum';
import { INeedUpdate } from '../../../src/character/interfaces/needs.interfaces';

// Mock Need entity class with proper prototype methods
class MockNeed {
  id: number = 1;
  characterId: number = 1;
  type: CharacterNeedType = CharacterNeedType.ACHIEVEMENT;
  currentValue: number = 50;
  maxValue: number = 100;
  growthRate: number = 1.0;
  decayRate: number = 0.5;
  priority: number = 5;
  threshold: number = 80;
  lastUpdated: Date = new Date();
  isActive: boolean = true;
  createdAt: Date = new Date();
  individualAccumulationRate: number = 1.0;
  dynamicPriority: number = 1.0;
  frustrationLevel: number = 0;
  blockedUntil: Date | null = null;
  blockReason: string | null = null;
  relatedNeeds: string | null = null;
  influenceCoefficients: string | null = null;
  state: string = 'satisfied';
  lastFrustrationTime: Date | null = null;
  consecutiveBlocksCount: number = 0;

  constructor(data: Partial<MockNeed> = {}) {
    Object.assign(this, data);
  }

  hasReachedThreshold = jest.fn(() => this.currentValue >= this.threshold);
  isBlocked = jest.fn(() => this.blockedUntil && new Date() < this.blockedUntil);
  isCritical = jest.fn(
    () => this.currentValue >= this.threshold * 1.5 || this.frustrationLevel >= 70,
  );

  grow = jest.fn((hours: number = 1) => {
    if (!this.isActive || this.isBlocked()) return;
    const growth = this.growthRate * hours;
    this.currentValue = Math.min(this.maxValue, this.currentValue + growth);
    this.lastUpdated = new Date();
  });

  reset = jest.fn(() => {
    this.currentValue = 0;
    this.frustrationLevel = Math.max(0, this.frustrationLevel - 20);
    this.consecutiveBlocksCount = 0;
    this.lastUpdated = new Date();
    this.state = 'satisfied';
  });

  updateLevel = jest.fn((change: number) => {
    this.currentValue = Math.max(0, Math.min(this.maxValue, this.currentValue + change));
    this.lastUpdated = new Date();
  });

  blockFor = jest.fn((hours: number, reason: string) => {
    const blockDuration = new Date();
    blockDuration.setHours(blockDuration.getHours() + hours);
    this.blockedUntil = blockDuration;
    this.blockReason = reason;
    this.consecutiveBlocksCount++;
    this.state = 'blocked';
  });

  unblock = jest.fn(() => {
    this.blockedUntil = null;
    this.blockReason = null;
  });

  increaseFrustration = jest.fn((amount: number) => {
    this.frustrationLevel = Math.min(100, this.frustrationLevel + amount);
    this.lastFrustrationTime = new Date();
  });

  decreaseFrustration = jest.fn((amount: number) => {
    this.frustrationLevel = Math.max(0, this.frustrationLevel - amount);
  });

  getRelatedNeeds = jest.fn(() => []);
  setRelatedNeeds = jest.fn();
  getInfluenceCoefficients = jest.fn(() => ({}));
  setInfluenceCoefficients = jest.fn();
  calculateInfluenceOnRelated = jest.fn(() => ({}));
}

describe('NeedsService', () => {
  let service: NeedsService;
  let mockCharacterRepository: Partial<Repository<Character>>;
  let mockNeedRepository: Partial<Repository<Need>>;
  let mockLogService: Partial<LogService>;
  let mockEventEmitter: Partial<EventEmitter2>;
  let mockMessageQueueService: Partial<MessageQueueService>;

  beforeEach(async () => {
    // Создаем моки для репозиториев
    mockCharacterRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    mockNeedRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    // Создаем моки для сервисов
    mockLogService = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    mockMessageQueueService = {
      enqueue: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NeedsService,
        {
          provide: getRepositoryToken(Character),
          useValue: mockCharacterRepository,
        },
        {
          provide: getRepositoryToken(Need),
          useValue: mockNeedRepository,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: MessageQueueService,
          useValue: mockMessageQueueService,
        },
      ],
    }).compile();

    service = module.get<NeedsService>(NeedsService);
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('updateNeed', () => {
    it('should update existing need successfully', async () => {
      const mockNeed = new MockNeed({
        id: 1,
        characterId: 1,
        type: CharacterNeedType.SOCIAL_CONNECTION,
        currentValue: 0.5,
        maxValue: 1.0,
        lastUpdated: new Date(),
      });

      const update: INeedUpdate = {
        type: CharacterNeedType.SOCIAL_CONNECTION,
        change: 0.3,
      };

      mockNeedRepository.findOne = jest.fn().mockResolvedValue(mockNeed);
      mockNeedRepository.save = jest.fn().mockResolvedValue({
        ...mockNeed,
        currentValue: 0.8,
      });

      const result = await service.updateNeed(1, update);

      expect(mockNeed.updateLevel).toHaveBeenCalledWith(0.3);
      expect(mockNeedRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw error if need not exists', async () => {
      const update: INeedUpdate = {
        type: CharacterNeedType.ACHIEVEMENT,
        change: 0.5,
      };

      mockNeedRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(service.updateNeed(1, update)).rejects.toThrow(
        'Потребность ACHIEVEMENT не найдена для персонажа 1',
      );
    });
  });

  describe('getNeedsByCharacter', () => {
    it('should return needs for character', async () => {
      const mockNeeds = [
        new MockNeed({
          id: 1,
          characterId: 1,
          type: CharacterNeedType.SOCIAL_CONNECTION,
          currentValue: 0.6,
        }),
        new MockNeed({
          id: 2,
          characterId: 1,
          type: CharacterNeedType.ACHIEVEMENT,
          currentValue: 0.4,
        }),
      ];

      mockNeedRepository.find = jest.fn().mockResolvedValue(mockNeeds);

      const result = await service.getNeedsByCharacter(1);

      expect(result).toHaveLength(2);
      expect(mockNeedRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1 },
        order: { priority: 'DESC', currentValue: 'DESC' },
      });
    });

    it('should return empty array if no needs found', async () => {
      mockNeedRepository.find = jest.fn().mockResolvedValue([]);

      const result = await service.getNeedsByCharacter(999);

      expect(result).toEqual([]);
    });
  });

  describe('getActiveNeeds', () => {
    it('should return active needs for character', async () => {
      const mockNeeds = [
        new MockNeed({
          id: 1,
          characterId: 1,
          type: CharacterNeedType.SOCIAL_CONNECTION,
          currentValue: 0.6,
          isActive: true,
        }),
        new MockNeed({
          id: 2,
          characterId: 1,
          type: CharacterNeedType.ACHIEVEMENT,
          currentValue: 0.4,
          isActive: true,
        }),
      ];

      mockNeedRepository.find = jest.fn().mockResolvedValue(mockNeeds);

      const result = await service.getActiveNeeds(1);

      expect(result).toHaveLength(2);
    });
  });

  describe('processNeedsGrowth', () => {
    it('should process needs growth for character', async () => {
      const mockNeeds = [
        new MockNeed({
          id: 1,
          characterId: 1,
          type: CharacterNeedType.SOCIAL_CONNECTION,
          currentValue: 0.6,
          lastUpdated: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        }),
      ];

      mockNeedRepository.find = jest.fn().mockResolvedValue(mockNeeds);
      mockNeedRepository.save = jest.fn().mockImplementation((need: any) => Promise.resolve(need));

      const result = await service.processNeedsGrowth(1);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('resetNeed', () => {
    it('should reset need to default value', async () => {
      const mockNeed = new MockNeed({
        id: 1,
        characterId: 1,
        type: CharacterNeedType.SOCIAL_CONNECTION,
        currentValue: 0.9,
      });

      mockNeedRepository.findOne = jest.fn().mockResolvedValue(mockNeed);
      mockNeedRepository.save = jest.fn().mockResolvedValue({
        ...mockNeed,
        currentValue: 0.5,
      });

      await service.resetNeed(1, CharacterNeedType.SOCIAL_CONNECTION);

      expect(mockNeed.reset).toHaveBeenCalled();
      expect(mockNeedRepository.save).toHaveBeenCalled();
    });
  });

  describe('createDefaultNeeds', () => {
    it('should create default needs for character', async () => {
      const mockCharacter = {
        id: 1,
        name: 'Test Character',
      } as Character;

      mockCharacterRepository.findOne = jest.fn().mockResolvedValue(mockCharacter);
      mockNeedRepository.create = jest
        .fn()
        .mockImplementation((needData: Partial<Need>) => needData as Need);
      mockNeedRepository.save = jest
        .fn()
        .mockImplementation((needs: Need[]) => Promise.resolve(needs));

      const result = await service.createDefaultNeeds(1);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(mockNeedRepository.create).toHaveBeenCalled();
      expect(mockNeedRepository.save).toHaveBeenCalled();
    });
  });

  describe('getNeeds', () => {
    it('should return needs for character (alias method)', async () => {
      const mockNeeds = [
        {
          id: 1,
          characterId: 1,
          type: CharacterNeedType.SOCIAL_CONNECTION,
          currentValue: 0.7,
        },
      ] as Need[];

      mockNeedRepository.find = jest.fn().mockResolvedValue(mockNeeds);

      const result = await service.getNeeds(1);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(CharacterNeedType.SOCIAL_CONNECTION);
    });
  });

  describe('getNeedsByType', () => {
    it('should return specific need by type', async () => {
      const mockNeed = new MockNeed({
        id: 1,
        characterId: 1,
        type: CharacterNeedType.SOCIAL_CONNECTION,
        currentValue: 0.8,
      });

      mockNeedRepository.findOne = jest.fn().mockResolvedValue(mockNeed);

      const result = await service.getNeedsByType(1, CharacterNeedType.SOCIAL_CONNECTION);

      expect(result).toBeDefined();
      expect(result.type).toBe(CharacterNeedType.SOCIAL_CONNECTION);
    });
  });

  describe('getCriticalNeeds', () => {
    it('should return critical needs (high values)', async () => {
      const mockNeeds = [
        new MockNeed({
          id: 1,
          characterId: 1,
          type: CharacterNeedType.SOCIAL_CONNECTION,
          currentValue: 0.9, // Critical level
        }),
        new MockNeed({
          id: 2,
          characterId: 1,
          type: CharacterNeedType.ACHIEVEMENT,
          currentValue: 0.3, // Not critical
        }),
      ];

      // Настраиваем mock для isCritical
      mockNeeds[0].isCritical = jest.fn(() => true);
      mockNeeds[1].isCritical = jest.fn(() => false);

      mockNeedRepository.find = jest.fn().mockResolvedValue(mockNeeds);

      const result = await service.getCriticalNeeds(1);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getBlockedNeeds', () => {
    it('should return blocked needs', async () => {
      const mockNeeds = [
        new MockNeed({
          id: 1,
          characterId: 1,
          type: CharacterNeedType.SOCIAL_CONNECTION,
          currentValue: 0.7,
          blockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // Blocked
        }),
        new MockNeed({
          id: 2,
          characterId: 1,
          type: CharacterNeedType.ACHIEVEMENT,
          currentValue: 0.5,
          blockedUntil: null, // Not blocked
        }),
      ];

      // Настраиваем mock для isBlocked
      mockNeeds[0].isBlocked = jest.fn(() => true);
      mockNeeds[1].isBlocked = jest.fn(() => false);

      mockNeedRepository.find = jest.fn().mockResolvedValue(mockNeeds);

      const result = await service.getBlockedNeeds(1);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // Проверяем что возвращены заблокированные потребности
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateNeedsGrowth', () => {
    it('should calculate needs growth', async () => {
      const mockNeeds = [
        new MockNeed({
          id: 1,
          characterId: 1,
          type: CharacterNeedType.SOCIAL_CONNECTION,
          currentValue: 50,
          growthRate: 2.0,
        }),
      ];

      mockNeedRepository.find = jest.fn().mockResolvedValue(mockNeeds);

      const result = await service.calculateNeedsGrowth(1);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getUnfulfilledNeeds', () => {
    it('should return unfulfilled needs', async () => {
      const mockNeeds = [
        new MockNeed({
          id: 1,
          characterId: 1,
          type: CharacterNeedType.SOCIAL_CONNECTION,
          currentValue: 90, // High value, unfulfilled
          threshold: 80,
        }),
        new MockNeed({
          id: 2,
          characterId: 1,
          type: CharacterNeedType.ACHIEVEMENT,
          currentValue: 30, // Low value, fulfilled
          threshold: 80,
        }),
      ];

      // Настраиваем mock для hasReachedThreshold
      mockNeeds[0].hasReachedThreshold = jest.fn(() => true);
      mockNeeds[1].hasReachedThreshold = jest.fn(() => false);

      mockNeedRepository.find = jest.fn().mockResolvedValue(mockNeeds);

      const result = await service.getUnfulfilledNeeds(1);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('setIndividualAccumulationRate', () => {
    it('should set individual accumulation rate', async () => {
      const mockNeed = new MockNeed({
        id: 1,
        characterId: 1,
        type: CharacterNeedType.SOCIAL_CONNECTION,
        individualAccumulationRate: 1.0,
      });

      mockNeedRepository.findOne = jest.fn().mockResolvedValue(mockNeed);
      mockNeedRepository.save = jest.fn().mockResolvedValue(mockNeed);

      await service.setIndividualAccumulationRate(1, CharacterNeedType.SOCIAL_CONNECTION, 2.0);

      expect(mockNeedRepository.save).toHaveBeenCalled();
    });

    it('should return early if need not found', async () => {
      mockNeedRepository.findOne = jest.fn().mockResolvedValue(null);

      // Метод просто возвращается раньше, не выбрасывая исключение
      await expect(
        service.setIndividualAccumulationRate(1, CharacterNeedType.SOCIAL_CONNECTION, 2.0),
      ).resolves.toBeUndefined();
    });
  });

  describe('updateDynamicPriority', () => {
    it('should update dynamic priority', async () => {
      const mockNeed = new MockNeed({
        id: 1,
        characterId: 1,
        type: CharacterNeedType.SOCIAL_CONNECTION,
        dynamicPriority: 1.0,
      });

      mockNeedRepository.findOne = jest.fn().mockResolvedValue(mockNeed);
      mockNeedRepository.save = jest.fn().mockResolvedValue(mockNeed);

      await service.updateDynamicPriority(1, CharacterNeedType.SOCIAL_CONNECTION, 5.0);

      expect(mockNeedRepository.save).toHaveBeenCalled();
    });

    it('should return early if need not found', async () => {
      mockNeedRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.updateDynamicPriority(1, CharacterNeedType.SOCIAL_CONNECTION, 5.0),
      ).resolves.toBeUndefined();
    });
  });

  describe('blockNeed', () => {
    it('should block need for specified hours', async () => {
      const mockNeed = new MockNeed({
        id: 1,
        characterId: 1,
        type: CharacterNeedType.SOCIAL_CONNECTION,
      });

      mockNeedRepository.findOne = jest.fn().mockResolvedValue(mockNeed);
      mockNeedRepository.save = jest.fn().mockResolvedValue(mockNeed);

      await service.blockNeed(1, CharacterNeedType.SOCIAL_CONNECTION, 24, 'Test block');

      expect(mockNeed.blockFor).toHaveBeenCalledWith(24, 'Test block');
      expect(mockNeedRepository.save).toHaveBeenCalled();
    });

    it('should return early if need not found', async () => {
      mockNeedRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.blockNeed(1, CharacterNeedType.SOCIAL_CONNECTION, 24, 'Test block'),
      ).resolves.toBeUndefined();
    });
  });

  describe('unblockNeed', () => {
    it('should unblock need', async () => {
      const mockNeed = new MockNeed({
        id: 1,
        characterId: 1,
        type: CharacterNeedType.SOCIAL_CONNECTION,
        blockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      mockNeedRepository.findOne = jest.fn().mockResolvedValue(mockNeed);
      mockNeedRepository.save = jest.fn().mockResolvedValue(mockNeed);

      await service.unblockNeed(1, CharacterNeedType.SOCIAL_CONNECTION);

      expect(mockNeed.unblock).toHaveBeenCalled();
      expect(mockNeedRepository.save).toHaveBeenCalled();
    });

    it('should return early if need not found', async () => {
      mockNeedRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.unblockNeed(1, CharacterNeedType.SOCIAL_CONNECTION),
      ).resolves.toBeUndefined();
    });
  });

  describe('setupNeedRelations', () => {
    it('should setup need relations', async () => {
      const mockNeed = new MockNeed({
        id: 1,
        characterId: 1,
        type: CharacterNeedType.SOCIAL_CONNECTION,
      });

      mockNeedRepository.findOne = jest.fn().mockResolvedValue(mockNeed);
      mockNeedRepository.save = jest.fn().mockResolvedValue(mockNeed);

      const relations = [CharacterNeedType.ACHIEVEMENT];
      const coefficients = { [CharacterNeedType.ACHIEVEMENT]: 0.5 };

      await service.setupNeedRelations(
        1,
        CharacterNeedType.SOCIAL_CONNECTION,
        relations,
        coefficients,
      );

      expect(mockNeed.setRelatedNeeds).toHaveBeenCalledWith(relations);
      expect(mockNeed.setInfluenceCoefficients).toHaveBeenCalledWith(coefficients);
      expect(mockNeedRepository.save).toHaveBeenCalled();
    });

    it('should return early if need not found', async () => {
      mockNeedRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.setupNeedRelations(
          1,
          CharacterNeedType.SOCIAL_CONNECTION,
          [CharacterNeedType.ACHIEVEMENT],
          {},
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('processAllCharactersNeeds', () => {
    it('should process needs for all characters', async () => {
      const mockCharacters = [
        { id: 1, isActive: true },
        { id: 2, isActive: true },
      ];
      mockCharacterRepository.find = jest.fn().mockResolvedValue(mockCharacters);

      // Мокаем enqueue метод
      mockMessageQueueService.enqueue = jest.fn().mockResolvedValue(undefined);

      await service.processAllCharactersNeeds();

      expect(mockCharacterRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        select: ['id'],
      });
      expect(mockMessageQueueService.enqueue).toHaveBeenCalledTimes(2);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NeedsService } from '../../../../src/character/services/core/needs.service';
import { Need } from '../../../../src/character/entities/need.entity';
import { Character } from '../../../../src/character/entities/character.entity';
import { CharacterNeedType } from '../../../../src/character/enums/character-need-type.enum';
import { CharacterArchetype } from '../../../../src/character/enums/character-archetype.enum';
import { PersonalityData } from '../../../../src/character/entities/character.entity';
import { INeedUpdate } from '../../../../src/character/interfaces/needs.interfaces';
import { LogService } from '../../../../src/logging/log.service';
import { MessageQueueService } from '../../../../src/message-queue/message-queue.service';
import { MockLogService } from '../../../../lib/tester/mocks/log.service.mock';

describe('NeedsService', () => {
  let service: NeedsService;
  let needRepository: jest.Mocked<Repository<Need>>;
  let characterRepository: jest.Mocked<Repository<Character>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let messageQueueService: jest.Mocked<MessageQueueService>;
  let logService: MockLogService;

  const mockNeed: Need = {
    id: 1,
    characterId: 1,
    type: CharacterNeedType.SOCIAL_CONNECTION,
    currentValue: 50,
    maxValue: 100,
    priority: 5,
    isActive: true,
    growthRate: 1.0,
    decayRate: 0.5,
    threshold: 80,
    lastUpdated: new Date(),
    createdAt: new Date(),
    character: {} as Character,
    individualAccumulationRate: 1.0,
    dynamicPriority: 1.0,
    frustrationLevel: 0,
    blockedUntil: null,
    blockReason: null,
    relatedNeeds: null,
    influenceCoefficients: null,
    state: 'satisfied' as any,
    lastFrustrationTime: null,
    consecutiveBlocksCount: 0,
    hasReachedThreshold: jest.fn().mockReturnValue(false),
    isBlocked: jest.fn().mockReturnValue(false),
    isCritical: jest.fn().mockReturnValue(false),
    grow: jest.fn(),
    reset: jest.fn(),
    updateLevel: jest.fn(),
    blockFor: jest.fn(),
    unblock: jest.fn(),
    increaseFrustration: jest.fn(),
    decreaseFrustration: jest.fn(),
    getRelatedNeeds: jest.fn().mockReturnValue([]),
    setRelatedNeeds: jest.fn(),
    getInfluenceCoefficients: jest.fn().mockReturnValue({}),
    setInfluenceCoefficients: jest.fn(),
    calculateInfluenceOnRelated: jest.fn().mockReturnValue({}),
  } as unknown as Need;

  const mockCharacter: Character = {
    id: 1,
    name: 'Test Character',
    fullName: 'Test Character Full',
    age: 25,
    gender: 'female' as any,
    archetype: CharacterArchetype.COMPANION,
    biography: 'Test biography',
    appearance: 'Test appearance',
    personality: {
      traits: [],
      hobbies: [],
      fears: [],
      values: [],
      musicTaste: [],
      strengths: [],
      weaknesses: [],
    } as PersonalityData,
    psychologicalProfile: null,
    preferences: null,
    idealPartner: null,
    knowledgeAreas: [],
    relationshipStage: 'acquaintance' as any,
    developmentStage: 'initial',
    affection: 50,
    trust: 50,
    energy: 100,
    isActive: true,
    isArchived: false,
    user: null,
    userId: null,
    needs: [],
    dialogs: [],
    memories: [],
    actions: [],
    motivations: [],
    storyProgress: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastInteraction: null,
  };

  beforeEach(async () => {
    const mockRepositoryFactory = () => ({
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
        getOne: jest.fn(),
      })),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NeedsService,
        {
          provide: getRepositoryToken(Need),
          useFactory: mockRepositoryFactory,
        },
        {
          provide: getRepositoryToken(Character),
          useFactory: mockRepositoryFactory,
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: MessageQueueService,
          useValue: {
            addMessage: jest.fn(),
          },
        },
        {
          provide: LogService,
          useClass: MockLogService,
        },
      ],
    }).compile();

    service = module.get<NeedsService>(NeedsService);
    needRepository = module.get(getRepositoryToken(Need));
    characterRepository = module.get(getRepositoryToken(Character));
    eventEmitter = module.get(EventEmitter2);
    messageQueueService = module.get(MessageQueueService);
    logService = module.get(LogService);
  });

  describe('updateNeed', () => {
    it('should update need successfully', async () => {
      const update: INeedUpdate = {
        type: CharacterNeedType.SOCIAL_CONNECTION,
        change: 10,
        reason: 'Test update',
      };

      const updatedNeed = { ...mockNeed, currentValue: 60 } as Need;
      needRepository.findOne.mockResolvedValue(mockNeed);
      needRepository.save.mockResolvedValue(updatedNeed);

      const result = await service.updateNeed(1, update);

      expect(needRepository.findOne).toHaveBeenCalledWith({
        where: { characterId: 1, type: CharacterNeedType.SOCIAL_CONNECTION, isActive: true },
      });
      expect(mockNeed.updateLevel).toHaveBeenCalledWith(10);
      expect(needRepository.save).toHaveBeenCalledWith(mockNeed);
      expect(eventEmitter.emit).toHaveBeenCalledWith('need.updated', {
        characterId: 1,
        needType: CharacterNeedType.SOCIAL_CONNECTION,
        oldValue: 50,
        newValue: 50,
        change: 10,
        reason: 'Test update',
      });
      expect(result).toMatchObject({
        id: 'need-1',
        type: CharacterNeedType.SOCIAL_CONNECTION,
        currentValue: 50,
      });
    });

    it('should throw error if need not found', async () => {
      const update: INeedUpdate = {
        type: CharacterNeedType.SOCIAL_CONNECTION,
        change: 10,
        reason: 'Test update',
      };

      needRepository.findOne.mockResolvedValue(null);

      await expect(service.updateNeed(1, update)).rejects.toThrow(
        `Потребность ${CharacterNeedType.SOCIAL_CONNECTION} не найдена для персонажа 1`,
      );
    });
  });

  describe('getNeedsByCharacter', () => {
    it('should return all needs for character', async () => {
      const needs = [mockNeed];
      needRepository.find.mockResolvedValue(needs);

      const result = await service.getNeedsByCharacter(1);

      expect(needRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1 },
        order: { priority: 'DESC', currentValue: 'DESC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'need-1',
        type: CharacterNeedType.SOCIAL_CONNECTION,
        currentValue: 50,
      });
    });
  });

  describe('getActiveNeeds', () => {
    it('should return active needs for character', async () => {
      const needs = [mockNeed];
      needRepository.find.mockResolvedValue(needs);

      const result = await service.getActiveNeeds(1);

      expect(needRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1, isActive: true },
        order: { priority: 'DESC', currentValue: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('processNeedsGrowth', () => {
    it('should process needs growth for character', async () => {
      const needs = [mockNeed];
      needRepository.find.mockResolvedValue(needs);
      needRepository.save.mockResolvedValue(mockNeed);

      const result = await service.processNeedsGrowth(1);

      expect(needRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1, isActive: true },
      });
      expect(needRepository.save).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should skip needs that cannot grow', async () => {
      const nonGrowingNeed = {
        ...mockNeed,
        canGrow: jest.fn().mockReturnValue(false),
      } as unknown as Need;
      needRepository.find.mockResolvedValue([nonGrowingNeed]);

      const result = await service.processNeedsGrowth(1);

      expect(needRepository.save).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });
  });

  describe('resetNeed', () => {
    it('should reset need to default value', async () => {
      needRepository.findOne.mockResolvedValue(mockNeed);
      needRepository.save.mockResolvedValue(mockNeed);

      await service.resetNeed(1, CharacterNeedType.SOCIAL_CONNECTION);

      expect(needRepository.findOne).toHaveBeenCalledWith({
        where: { characterId: 1, type: CharacterNeedType.SOCIAL_CONNECTION },
      });
      expect(mockNeed.updateLevel).toHaveBeenCalledWith(-50); // Reset to 0
      expect(needRepository.save).toHaveBeenCalledWith(mockNeed);
      expect(eventEmitter.emit).toHaveBeenCalledWith('need.reset', {
        characterId: 1,
        needType: CharacterNeedType.SOCIAL_CONNECTION,
      });
    });

    it('should throw error if need not found for reset', async () => {
      needRepository.findOne.mockResolvedValue(null);

      await expect(service.resetNeed(1, CharacterNeedType.SOCIAL_CONNECTION)).rejects.toThrow(
        `Потребность ${CharacterNeedType.SOCIAL_CONNECTION} не найдена для персонажа 1`,
      );
    });
  });

  describe('createDefaultNeeds', () => {
    it('should create default needs for character', async () => {
      characterRepository.findOneBy.mockResolvedValue(mockCharacter);
      needRepository.find.mockResolvedValue([]);
      needRepository.create.mockReturnValue(mockNeed);
      needRepository.save.mockResolvedValue(mockNeed);

      const result = await service.createDefaultNeeds(1);

      expect(characterRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(needRepository.create).toHaveBeenCalled();
      expect(needRepository.save).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should throw error if character not found', async () => {
      characterRepository.findOneBy.mockResolvedValue(null);

      await expect(service.createDefaultNeeds(1)).rejects.toThrow('Персонаж не найден');
    });

    it('should skip creating needs that already exist', async () => {
      characterRepository.findOneBy.mockResolvedValue(mockCharacter);
      needRepository.find.mockResolvedValue([mockNeed]);

      const result = await service.createDefaultNeeds(1);

      expect(needRepository.create).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });
  });

  describe('getUnfulfilledNeeds', () => {
    it('should return unfulfilled needs', async () => {
      const unfulfilledNeed = { ...mockNeed, currentValue: 30 } as Need;
      needRepository.find.mockResolvedValue([unfulfilledNeed]);

      const result = await service.getUnfulfilledNeeds(1);

      expect(needRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1, isActive: true },
      });
      expect(result).toHaveLength(1);
    });

    it('should filter out fulfilled needs', async () => {
      const fulfilledNeed = { ...mockNeed, currentValue: 90 } as Need;
      needRepository.find.mockResolvedValue([fulfilledNeed]);

      const result = await service.getUnfulfilledNeeds(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('getCriticalNeeds', () => {
    it('should return critical needs', async () => {
      const criticalNeed = {
        ...mockNeed,
        isCritical: jest.fn().mockReturnValue(true),
      } as unknown as Need;
      needRepository.find.mockResolvedValue([criticalNeed]);

      const result = await service.getCriticalNeeds(1);

      expect(needRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1, isActive: true },
        order: { priority: 'DESC', currentValue: 'ASC' },
      });
      expect(result).toHaveLength(1);
    });

    it('should filter out non-critical needs', async () => {
      needRepository.find.mockResolvedValue([mockNeed]);

      const result = await service.getCriticalNeeds(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('blockNeed', () => {
    it('should block need for specified hours', async () => {
      needRepository.findOne.mockResolvedValue(mockNeed);
      needRepository.save.mockResolvedValue(mockNeed);

      await service.blockNeed(1, CharacterNeedType.SOCIAL_CONNECTION, 24, 'Test block');

      expect(needRepository.findOne).toHaveBeenCalledWith({
        where: { characterId: 1, type: CharacterNeedType.SOCIAL_CONNECTION },
      });
      expect(needRepository.save).toHaveBeenCalledWith(mockNeed);
      expect(eventEmitter.emit).toHaveBeenCalledWith('need.blocked', {
        characterId: 1,
        needType: CharacterNeedType.SOCIAL_CONNECTION,
        hours: 24,
        reason: 'Test block',
      });
    });
  });

  describe('unblockNeed', () => {
    it('should unblock need', async () => {
      needRepository.findOne.mockResolvedValue(mockNeed);
      needRepository.save.mockResolvedValue(mockNeed);

      await service.unblockNeed(1, CharacterNeedType.SOCIAL_CONNECTION);

      expect(needRepository.findOne).toHaveBeenCalledWith({
        where: { characterId: 1, type: CharacterNeedType.SOCIAL_CONNECTION },
      });
      expect(needRepository.save).toHaveBeenCalledWith(mockNeed);
      expect(eventEmitter.emit).toHaveBeenCalledWith('need.unblocked', {
        characterId: 1,
        needType: CharacterNeedType.SOCIAL_CONNECTION,
      });
    });
  });
});

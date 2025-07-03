import { Test, TestingModule } from '@nestjs/testing';
import { NeedsService } from '../../src/character/services/needs.service';
import { Need, NeedState } from '../../src/character/entities/need.entity';
import { Character } from '../../src/character/entities/character.entity';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogService } from '../../src/logging/log.service';
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';
import { MessageQueueService } from '../../src/message-queue/message-queue.service';

// Фабрика для создания полных моков Need
const createMockNeed = (override: Partial<Need> = {}): Need => {
  const need = new Need();
  need.id = Math.floor(Math.random() * 1000);
  need.characterId = 1;
  need.type = CharacterNeedType.AFFECTION;
  need.currentValue = 50;
  need.maxValue = 100;
  need.growthRate = 1;
  need.decayRate = 1;
  need.priority = 5;
  need.threshold = 80;
  need.lastUpdated = new Date();
  need.isActive = true;
  need.createdAt = new Date();
  need.individualAccumulationRate = 1.0;
  need.dynamicPriority = 1.0;
  need.frustrationLevel = 0;
  need.blockedUntil = null;
  need.blockReason = null;
  need.relatedNeeds = null;
  need.influenceCoefficients = null;
  need.state = NeedState.SATISFIED;
  need.lastFrustrationTime = null;
  need.consecutiveBlocksCount = 0;

  // Mock methods
  need.hasReachedThreshold = jest.fn().mockReturnValue(false);
  need.isBlocked = jest.fn().mockReturnValue(false);
  need.isCritical = jest.fn().mockReturnValue(false);
  need.grow = jest.fn();
  need.reset = jest.fn();
  need.updateLevel = jest.fn();
  need.blockFor = jest.fn();
  need.unblock = jest.fn();
  need.increaseFrustration = jest.fn();
  need.decreaseFrustration = jest.fn();
  need.getRelatedNeeds = jest.fn().mockReturnValue([]);
  need.setRelatedNeeds = jest.fn();
  need.getInfluenceCoefficients = jest.fn().mockReturnValue({});
  need.setInfluenceCoefficients = jest.fn();
  need.calculateInfluenceOnRelated = jest.fn().mockReturnValue({});

  return Object.assign(need, override) as Need;
};

describe('NeedsService', () => {
  let service: NeedsService;
  let needRepository: jest.Mocked<Repository<Need>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NeedsService,
        {
          provide: getRepositoryToken(Need),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(entity => Promise.resolve(entity)),
            create: jest.fn(data => data),
          },
        },
        {
          provide: getRepositoryToken(Character),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useClass: MockLogService,
        },
        {
          provide: MessageQueueService,
          useValue: {
            publish: jest.fn(),
            subscribe: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NeedsService>(NeedsService);
    needRepository = module.get(getRepositoryToken(Need));
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setIndividualAccumulationRate', () => {
    it('should set individual accumulation rate for a need', async () => {
      const characterId = 1;
      const needType = CharacterNeedType.AFFECTION;
      const rate = 2.5;

      const mockNeed = createMockNeed({ characterId, type: needType });
      needRepository.findOne.mockResolvedValue(mockNeed);

      await service.setIndividualAccumulationRate(characterId, needType, rate);

      expect(needRepository.findOne).toHaveBeenCalledWith({
        where: { characterId, type: needType, isActive: true },
      });
      expect(mockNeed.individualAccumulationRate).toBe(rate);
      expect(needRepository.save).toHaveBeenCalledWith(mockNeed);
    });

    it('should limit rate to valid range', async () => {
      const characterId = 1;
      const needType = CharacterNeedType.AFFECTION;
      const rate = 10.0;

      const mockNeed = createMockNeed({ characterId, type: needType });
      needRepository.findOne.mockResolvedValue(mockNeed);

      await service.setIndividualAccumulationRate(characterId, needType, rate);

      expect(mockNeed.individualAccumulationRate).toBe(5.0);
    });
  });

  describe('updateDynamicPriority', () => {
    it('should update dynamic priority based on context', async () => {
      const characterId = 1;
      const needType = CharacterNeedType.ATTENTION;
      const contextFactor = 2.0;

      const mockNeed = createMockNeed({ characterId, type: needType });
      needRepository.findOne.mockResolvedValue(mockNeed);

      await service.updateDynamicPriority(characterId, needType, contextFactor);

      expect(mockNeed.dynamicPriority).toBe(contextFactor);
      expect(eventEmitter.emit).toHaveBeenCalledWith('need.priority_updated', {
        characterId,
        needType,
        newPriority: contextFactor,
        contextFactor,
      });
    });
  });

  describe('blockNeed', () => {
    it('should block need and call its blockFor method', async () => {
      const characterId = 1;
      const needType = CharacterNeedType.VALIDATION;
      const hours = 2;
      const reason = 'Testing block';

      const mockNeed = createMockNeed({ characterId, type: needType });
      needRepository.findOne.mockResolvedValue(mockNeed);

      await service.blockNeed(characterId, needType, hours, reason);

      expect(mockNeed.blockFor).toHaveBeenCalledWith(hours, reason);
      expect(eventEmitter.emit).toHaveBeenCalledWith('need.blocked', {
        characterId,
        needType,
        hours,
        reason,
        frustrationLevel: mockNeed.frustrationLevel,
      });
    });
  });

  describe('setupNeedRelations', () => {
    it('should setup relations between needs', async () => {
      const characterId = 1;
      const needType = CharacterNeedType.AFFECTION;
      const relatedNeeds = [CharacterNeedType.ATTENTION, CharacterNeedType.VALIDATION];
      const influenceCoefficients = {
        [CharacterNeedType.ATTENTION]: 0.5,
        [CharacterNeedType.VALIDATION]: 0.3,
      };

      const mockNeed = createMockNeed({ characterId, type: needType });
      needRepository.findOne.mockResolvedValue(mockNeed);

      await service.setupNeedRelations(characterId, needType, relatedNeeds, influenceCoefficients);

      expect(mockNeed.setRelatedNeeds).toHaveBeenCalledWith(relatedNeeds);
      expect(mockNeed.setInfluenceCoefficients).toHaveBeenCalledWith(influenceCoefficients);
      expect(needRepository.save).toHaveBeenCalledWith(mockNeed);
    });
  });

  describe('getCriticalNeeds', () => {
    it('should return only critical needs', async () => {
      const characterId = 1;
      const criticalNeed = createMockNeed({ type: CharacterNeedType.AFFECTION });
      criticalNeed.isCritical = jest.fn().mockReturnValue(true);
      const nonCriticalNeed = createMockNeed({ type: CharacterNeedType.ATTENTION });
      nonCriticalNeed.isCritical = jest.fn().mockReturnValue(false);

      needRepository.find.mockResolvedValue([criticalNeed, nonCriticalNeed]);

      const result = await service.getCriticalNeeds(characterId);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(CharacterNeedType.AFFECTION);
    });
  });

  describe('getBlockedNeeds', () => {
    it('should return only blocked needs', async () => {
      const characterId = 1;
      const nonBlockedNeed = createMockNeed({ type: CharacterNeedType.AFFECTION });
      nonBlockedNeed.isBlocked = jest.fn().mockReturnValue(false);
      const blockedNeed = createMockNeed({ type: CharacterNeedType.ATTENTION });
      blockedNeed.isBlocked = jest.fn().mockReturnValue(true);

      needRepository.find.mockResolvedValue([nonBlockedNeed, blockedNeed]);

      const result = await service.getBlockedNeeds(characterId);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(CharacterNeedType.ATTENTION);
    });
  });
});

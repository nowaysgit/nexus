import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MotivationService } from '../../../../src/character/services/core/motivation.service';
import {
  CharacterMotivation,
  MotivationStatus,
  MotivationIntensity,
} from '../../../../src/character/entities/character-motivation.entity';
import { Character } from '../../../../src/character/entities/character.entity';
import { Need } from '../../../../src/character/entities/need.entity';
import { CharacterService } from '../../../../src/character/services/core/character.service';
import { NeedsService } from '../../../../src/character/services/core/needs.service';
import { CacheService } from '../../../../src/cache/cache.service';
import { LogService } from '../../../../src/logging/log.service';
import { MockLogService } from '../../../../lib/tester/mocks/log.service.mock';
import { CharacterNeedType } from '../../../../src/character/enums/character-need-type.enum';

describe('MotivationService', () => {
  let service: MotivationService;
  let motivationRepository: jest.Mocked<Repository<CharacterMotivation>>;
  let characterRepository: jest.Mocked<Repository<Character>>;
  let needRepository: jest.Mocked<Repository<Need>>;
  let configService: jest.Mocked<ConfigService>;
  let characterService: jest.Mocked<CharacterService>;
  let needsService: jest.Mocked<NeedsService>;
  let cacheService: jest.Mocked<CacheService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let logService: MockLogService;

  const mockMotivation: CharacterMotivation = {
    id: 1,
    motivationId: 'motivation-1',
    characterId: 1,
    relatedNeed: CharacterNeedType.SOCIAL_CONNECTION,
    description: 'Test motivation',
    priority: 5,
    currentValue: 50,
    thresholdValue: 80,
    accumulationRate: 1.5,
    resourceCost: 10,
    successProbability: 80,
    status: MotivationStatus.ACTIVE,
    intensity: MotivationIntensity.MODERATE,
    potentialReward: {
      needReduction: 10,
      emotionalBenefit: 'happiness',
      behaviorModifier: 'social',
      resourceGain: 5,
    },
    feedback: {
      lastAttemptResult: 'success',
      lastAttemptTime: new Date(),
      consecutiveFailures: 0,
      adjustmentFactor: 1.0,
    },
    lastUpdated: new Date(),
    expiresAt: null,
    character: {} as Character,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: jest.fn().mockReturnValue(true),
    calculateWeight: jest.fn().mockReturnValue(0.8),
    updateFeedback: jest.fn(),
  } as unknown as CharacterMotivation;

  const mockNeed: Need = {
    id: 1,
    characterId: 1,
    type: CharacterNeedType.SOCIAL_CONNECTION,
    currentValue: 30,
    maxValue: 100,
    growthRate: 1.0,
    decayRate: 0.5,
    priority: 5,
    threshold: 80,
    lastUpdated: new Date(),
    isActive: true,
    createdAt: new Date(),
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
    character: {} as Character,
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
        MotivationService,
        {
          provide: getRepositoryToken(CharacterMotivation),
          useFactory: mockRepositoryFactory,
        },
        {
          provide: getRepositoryToken(Character),
          useFactory: mockRepositoryFactory,
        },
        {
          provide: getRepositoryToken(Need),
          useFactory: mockRepositoryFactory,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: CharacterService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: NeedsService,
          useValue: {
            getUnfulfilledNeeds: jest.fn(),
            findByType: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
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
      ],
    }).compile();

    service = module.get<MotivationService>(MotivationService);
    motivationRepository = module.get(getRepositoryToken(CharacterMotivation));
    characterRepository = module.get(getRepositoryToken(Character));
    needRepository = module.get(getRepositoryToken(Need));
    configService = module.get(ConfigService);
    characterService = module.get(CharacterService);
    needsService = module.get(NeedsService);
    cacheService = module.get(CacheService);
    eventEmitter = module.get(EventEmitter2);
    logService = module.get(LogService);
  });

  describe('getCharacterMotivations', () => {
    it('should return active motivations sorted by priority', async () => {
      const motivations = [mockMotivation];
      motivationRepository.find.mockResolvedValue(motivations);

      const result = await service.getCharacterMotivations(1);

      expect(motivationRepository.find).toHaveBeenCalledWith({
        where: {
          characterId: 1,
          status: MotivationStatus.ACTIVE,
        },
        order: { priority: 'DESC', currentValue: 'DESC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: mockMotivation.motivationId,
        type: mockMotivation.relatedNeed,
        description: mockMotivation.description,
        priority: mockMotivation.priority,
        currentValue: mockMotivation.currentValue,
      });
    });

    it('should filter out inactive motivations', async () => {
      const inactiveMotivation = {
        ...mockMotivation,
        isActive: jest.fn().mockReturnValue(false),
        calculateWeight: jest.fn().mockReturnValue(0.8),
        updateFeedback: jest.fn(),
      } as unknown as CharacterMotivation;
      motivationRepository.find.mockResolvedValue([inactiveMotivation]);

      const result = await service.getCharacterMotivations(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('createMotivation', () => {
    it('should create a new motivation successfully', async () => {
      const options = {
        thresholdValue: 90,
        accumulationRate: 2.0,
        resourceCost: 15,
        successProbability: 0.9,
      };

      characterService.findOne.mockResolvedValue({} as any);
      motivationRepository.create.mockReturnValue(mockMotivation);
      motivationRepository.save.mockResolvedValue(mockMotivation);

      const result = await service.createMotivation(
        1,
        CharacterNeedType.SOCIAL_CONNECTION,
        'Test motivation',
        5,
        options,
      );

      expect(characterService.findOne).toHaveBeenCalledWith(1);
      expect(motivationRepository.create).toHaveBeenCalled();
      expect(motivationRepository.save).toHaveBeenCalledWith(mockMotivation);
      expect(result).toEqual(mockMotivation);
    });

    it('should create motivation with default options', async () => {
      characterService.findOne.mockResolvedValue({} as any);
      motivationRepository.create.mockReturnValue(mockMotivation);
      motivationRepository.save.mockResolvedValue(mockMotivation);

      const result = await service.createMotivation(
        1,
        CharacterNeedType.SOCIAL_CONNECTION,
        'Test motivation',
      );

      expect(result).toEqual(mockMotivation);
    });

    it('should handle errors when character not found', async () => {
      characterService.findOne.mockRejectedValue(new Error('Character not found'));

      await expect(
        service.createMotivation(1, CharacterNeedType.SOCIAL_CONNECTION, 'Test'),
      ).rejects.toThrow();
    });
  });

  describe('updateMotivationValue', () => {
    it('should update motivation value successfully', async () => {
      const updatedMotivation = {
        ...mockMotivation,
        currentValue: 60,
        isActive: jest.fn().mockReturnValue(true),
        calculateWeight: jest.fn().mockReturnValue(0.8),
        updateFeedback: jest.fn(),
      } as unknown as CharacterMotivation;
      motivationRepository.findOneBy.mockResolvedValue(mockMotivation);
      motivationRepository.save.mockResolvedValue(updatedMotivation);

      const result = await service.updateMotivationValue('motivation-1', 10);

      expect(motivationRepository.findOneBy).toHaveBeenCalledWith({ id: 'motivation-1' });
      expect(motivationRepository.save).toHaveBeenCalledWith(mockMotivation);
      expect(result).toEqual(updatedMotivation);
    });

    it('should return null if motivation not found', async () => {
      motivationRepository.findOneBy.mockResolvedValue(null);

      const result = await service.updateMotivationValue('motivation-1', 10);

      expect(result).toBeNull();
    });

    it('should emit event when motivation changes status', async () => {
      const updatedMotivation = {
        ...mockMotivation,
        status: MotivationStatus.FULFILLED,
        isActive: jest.fn().mockReturnValue(true),
        calculateWeight: jest.fn().mockReturnValue(0.8),
        updateFeedback: jest.fn(),
      } as unknown as CharacterMotivation;
      motivationRepository.findOneBy.mockResolvedValue(mockMotivation);
      motivationRepository.save.mockResolvedValue(updatedMotivation);

      await service.updateMotivationValue('motivation-1', 10);

      expect(eventEmitter.emit).toHaveBeenCalledWith('motivation.status_changed', {
        motivationId: 'motivation-1',
        oldStatus: MotivationStatus.ACTIVE,
        newStatus: MotivationStatus.FULFILLED,
      });
    });
  });

  describe('executeMotivationAction', () => {
    it('should execute motivation action successfully', async () => {
      motivationRepository.findOneBy.mockResolvedValue(mockMotivation);
      motivationRepository.save.mockResolvedValue(mockMotivation);

      const result = await service.executeMotivationAction('motivation-1');

      expect(motivationRepository.findOneBy).toHaveBeenCalledWith({ id: 'motivation-1' });
      expect(result).toEqual({
        success: true,
        result: 'success',
      });
    });

    it('should return blocked result if motivation is not active', async () => {
      const inactiveMotivation = {
        ...mockMotivation,
        isActive: jest.fn().mockReturnValue(false),
        calculateWeight: jest.fn().mockReturnValue(0.8),
        updateFeedback: jest.fn(),
      } as unknown as CharacterMotivation;
      motivationRepository.findOneBy.mockResolvedValue(inactiveMotivation);

      const result = await service.executeMotivationAction('motivation-1');

      expect(result).toEqual({
        success: false,
        result: 'blocked',
      });
    });

    it('should return failure result if motivation not found', async () => {
      motivationRepository.findOneBy.mockResolvedValue(null);

      const result = await service.executeMotivationAction('motivation-1');

      expect(result).toEqual({
        success: false,
        result: 'failure',
      });
    });
  });

  describe('generateMotivationsFromNeeds', () => {
    it('should generate motivations from unfulfilled needs', async () => {
      const needs = [mockNeed];
      needsService.getUnfulfilledNeeds.mockResolvedValue(needs);
      motivationRepository.find.mockResolvedValue([]);
      motivationRepository.create.mockReturnValue(mockMotivation);
      motivationRepository.save.mockResolvedValue(mockMotivation);

      const result = await service.generateMotivationsFromNeeds(1);

      expect(needsService.getUnfulfilledNeeds).toHaveBeenCalledWith(1);
      expect(motivationRepository.create).toHaveBeenCalled();
      expect(motivationRepository.save).toHaveBeenCalledWith(mockMotivation);
      expect(result).toEqual([mockMotivation]);
    });

    it('should skip needs that already have active motivations', async () => {
      const needs = [mockNeed];
      const existingMotivations = [mockMotivation];
      needsService.getUnfulfilledNeeds.mockResolvedValue(needs);
      motivationRepository.find.mockResolvedValue(existingMotivations);

      const result = await service.generateMotivationsFromNeeds(1);

      expect(result).toEqual([]);
    });
  });

  describe('updateMotivationsBackground', () => {
    it('should update all active motivations in background', async () => {
      const motivations = [mockMotivation];
      motivationRepository.find.mockResolvedValue(motivations);
      motivationRepository.save.mockResolvedValue(mockMotivation);

      await service.updateMotivationsBackground();

      expect(motivationRepository.find).toHaveBeenCalledWith({
        where: { status: MotivationStatus.ACTIVE },
      });
      // Motivation values are updated automatically in the service
      expect(motivationRepository.save).toHaveBeenCalledWith(mockMotivation);
    });
  });

  describe('cleanupExpiredMotivations', () => {
    it('should cleanup expired motivations', async () => {
      const expiredMotivation = {
        ...mockMotivation,
        expiresAt: new Date(Date.now() - 1000),
        status: MotivationStatus.ACTIVE,
        isActive: jest.fn().mockReturnValue(true),
        calculateWeight: jest.fn().mockReturnValue(0.8),
        updateFeedback: jest.fn(),
      } as unknown as CharacterMotivation;
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([expiredMotivation]),
      };
      motivationRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
      motivationRepository.save.mockResolvedValue({
        ...expiredMotivation,
        status: MotivationStatus.EXPIRED,
        isActive: jest.fn().mockReturnValue(false),
        calculateWeight: jest.fn().mockReturnValue(0.8),
        updateFeedback: jest.fn(),
      } as unknown as CharacterMotivation);

      await service.cleanupExpiredMotivations();

      expect(queryBuilder.where).toHaveBeenCalledWith('motivation.expiresAt IS NOT NULL');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('motivation.expiresAt < :now', {
        now: expect.any(Date),
      });
      expect(motivationRepository.save).toHaveBeenCalled();
    });
  });
});

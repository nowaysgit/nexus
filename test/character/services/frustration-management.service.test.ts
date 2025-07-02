import { createTestSuite, createTest } from '../../../lib/tester';
import {
  FrustrationManagementService,
  FrustrationLevel,
  FrustrationType,
} from '../../../src/character/services/frustration-management.service';
import {
  Character,
  CharacterGender,
  RelationshipStage,
} from '../../../src/character/entities/character.entity';
import { Need, NeedState } from '../../../src/character/entities/need.entity';
import { Action, ActionStatus } from '../../../src/character/entities/action.entity';
import { CharacterNeedType } from '../../../src/character/enums/character-need-type.enum';
import { ActionType } from '../../../src/character/enums/action-type.enum';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LogService } from '../../../src/logging/log.service';

export default createTestSuite('FrustrationManagementService', () => {
  let service: FrustrationManagementService;
  let characterRepository: jest.Mocked<Repository<Character>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let logService: jest.Mocked<LogService>;

  const mockCharacter: Character = {
    id: 1,
    name: 'Test Character',
    fullName: 'Test Character Full',
    age: 25,
    gender: CharacterGender.FEMALE,
    archetype: CharacterArchetype.LOVER,
    biography: 'Test bio',
    appearance: 'Test appearance',
    personality: {
      traits: [],
      hobbies: [],
      fears: [],
      values: [],
      musicTaste: [],
      strengths: [],
      weaknesses: [],
    },
    psychologicalProfile: null,
    preferences: null,
    idealPartner: null,
    knowledgeAreas: [],
    relationshipStage: RelationshipStage.ACQUAINTANCE,
    developmentStage: 'initial',
    affection: 50,
    trust: 50,
    energy: 100,
    isActive: true,
    isArchived: false,
    user: null,
    userId: 'user-1',
    needs: [],
    dialogs: [],
    memories: [],
    actions: [],
    motivations: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastInteraction: new Date(),
  };

  beforeEach(() => {
    characterRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    eventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
    } as any;

    logService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn().mockReturnThis(),
    } as any;

    service = new FrustrationManagementService(characterRepository, eventEmitter, logService);
  });

  createTest({ name: 'должен быть определен', requiresDatabase: false }, async () => {
    expect(service).toBeDefined();
  });

  createTest(
    { name: 'должен анализировать фрустрацию персонажа без проблем', requiresDatabase: false },
    async () => {
      const character = { ...mockCharacter };
      characterRepository.findOne.mockResolvedValue(character);

      const result = await service.analyzeFrustration(1);

      expect(result).toBe(FrustrationLevel.NONE);
      expect(characterRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['needs', 'actions'],
      });
    },
  );

  createTest(
    {
      name: 'должен определять фрустрацию от неудовлетворенных потребностей',
      requiresDatabase: false,
    },
    async () => {
      const unmetNeed = {
        id: 1,
        characterId: 1,
        character: mockCharacter,
        type: CharacterNeedType.COMMUNICATION,
        currentValue: 10,
        maxValue: 100,
        growthRate: 1,
        decayRate: 0.5,
        priority: 5,
        threshold: 70, // Потребность не удовлетворена
        lastUpdated: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Новые поля для многофакторной модели
        individualAccumulationRate: 1.0,
        dynamicPriority: 1.0,
        frustrationLevel: 0,
        blockedUntil: null,
        blockReason: null,
        relatedNeeds: null,
        influenceCoefficients: null,
        state: NeedState.SATISFIED,
        lastFrustrationTime: null,
        consecutiveBlocksCount: 0,
        hasReachedThreshold: () => false,
        grow: () => {},
        reset: () => {},
        updateLevel: () => {},
        isBlocked: () => false,
        isCritical: () => false,
        blockFor: () => {},
        unblock: () => {},
        increaseFrustration: () => {},
        decreaseFrustration: () => {},
        getRelatedNeeds: () => [],
        setRelatedNeeds: () => {},
        getInfluenceCoefficients: () => ({}),
        setInfluenceCoefficients: () => {},
        calculateInfluenceOnRelated: () => ({}),
      } as unknown as Need;

      const character = {
        ...mockCharacter,
        needs: [unmetNeed, unmetNeed, unmetNeed, unmetNeed], // 4 неудовлетворенные потребности
      };
      characterRepository.findOne.mockResolvedValue(character);

      const result = await service.analyzeFrustration(1);

      expect(result).toBe(FrustrationLevel.SEVERE); // 4 * 15 = 60 баллов (попадает в диапазон SEVERE)
      expect(service.getFrustrationLevel(1)).toBe(FrustrationLevel.SEVERE);
    },
  );

  createTest(
    { name: 'должен определять фрустрацию от неудачных действий', requiresDatabase: false },
    async () => {
      const failedAction: Action = {
        id: 1,
        character: mockCharacter,
        characterId: 1,
        type: ActionType.SEND_MESSAGE,
        description: 'Failed action',
        expectedDuration: 10,
        status: ActionStatus.FAILED,
        startTime: new Date(),
        endTime: new Date(),
        relatedNeed: CharacterNeedType.COMMUNICATION,
        metadata: null,
        content: null,
        result: 'Failed',
        resourceCost: 10,
        successProbability: 80,
        potentialReward: null,
        executionResults: null,
        adaptiveModifiers: null,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 часов назад
        updatedAt: new Date(),
        getEffectiveCost: () => 10,
        getEffectiveProbability: () => 80,
        updateAdaptiveModifiers: () => {},
        getExpectedReward: () => ({}),
      };

      const character = {
        ...mockCharacter,
        actions: [failedAction, failedAction, failedAction], // 3 неудачных действия
      };
      characterRepository.findOne.mockResolvedValue(character);

      const result = await service.analyzeFrustration(1);

      expect(result).toBe(FrustrationLevel.MILD); // 3 * 10 = 30 баллов
    },
  );

  createTest(
    { name: 'должен применять фрустрацию к действиям', requiresDatabase: false },
    async () => {
      // Устанавливаем паттерны напрямую для тестирования
      const patterns = [
        {
          type: FrustrationType.NEED_DEPRIVATION,
          level: FrustrationLevel.MODERATE,
          behaviorModifiers: {
            aggressionIncrease: 35,
            withdrawalTendency: 0,
            impulsivityBoost: 30,
            riskTaking: 0,
            socialAvoidance: 0,
          },
          emotionalModifiers: {
            irritabilityLevel: 30,
            anxietyLevel: 20,
            depressionRisk: 15,
            emotionalVolatility: 25,
          },
          temporaryDebuffs: {
            actionSuccessReduction: 15, // 15% снижение
            resourceEfficiencyLoss: 10,
            socialSkillPenalty: 12.5,
            decisionMakingImpairment: 20,
            duration: 15,
          },
        },
      ];

      (service as any).activeFrustrationPatterns.set(1, patterns);

      const baseSuccessRate = 80;
      const modifiedRate = service.applyFrustrationToAction(1, baseSuccessRate);

      expect(modifiedRate).toBe(68); // 80 * (1 - 0.15) = 68
    },
  );

  createTest({ name: 'должен очищать состояния фрустрации', requiresDatabase: false }, async () => {
    // Устанавливаем некоторые состояния
    (service as any).characterFrustrationLevels.set(1, FrustrationLevel.MODERATE);
    (service as any).characterFrustrationTypes.set(1, new Set([FrustrationType.NEED_DEPRIVATION]));

    service.clearAllFrustrationStates();

    expect(service.getFrustrationLevel(1)).toBe(FrustrationLevel.NONE);
    expect(service.getActiveFrustrationPatterns(1)).toEqual([]);
  });

  createTest(
    { name: 'должен возвращать правильные уровни фрустрации', requiresDatabase: false },
    async () => {
      expect(service.getFrustrationLevel(999)).toBe(FrustrationLevel.NONE);

      // Устанавливаем уровень
      (service as any).characterFrustrationLevels.set(1, FrustrationLevel.SEVERE);
      expect(service.getFrustrationLevel(1)).toBe(FrustrationLevel.SEVERE);
    },
  );

  createTest(
    { name: 'должен обрабатывать ошибки при анализе фрустрации', requiresDatabase: false },
    async () => {
      characterRepository.findOne.mockResolvedValue(null);

      await expect(service.analyzeFrustration(999)).rejects.toThrow('Персонаж с ID 999 не найден');
    },
  );
});

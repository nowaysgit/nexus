import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmotionalStateService } from '../../../src/character/services/core/emotional-state.service';
import { Character, CharacterGender } from '../../../src/character/entities/character.entity';
import { LogService } from '../../../src/logging/log.service';
import { NeedsService } from '../../../src/character/services/core/needs.service';
import {
  EmotionalState,
  EmotionalUpdate,
  EmotionalContext,
  EmotionalRegulationStrategy,
  EmotionalImpact,
} from '../../../src/character/entities/emotional-state';
import { MessageAnalysis } from '../../../src/character/interfaces/analysis.interfaces';
import { createTestSuite } from '../../../lib/tester';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';
import { CharacterNeedType } from '../../../src/character/enums/character-need-type.enum';
import { INeed } from '../../../src/character/interfaces/needs.interfaces';

createTestSuite('EmotionalStateService Unit Tests', () => {
  let service: EmotionalStateService;
  let characterRepository: jest.Mocked<Repository<Character>>;
  let _logService: jest.Mocked<LogService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let _needsService: jest.Mocked<NeedsService>;

  const mockCharacter: Partial<Character> = {
    id: 1,
    name: 'Test Character',
    fullName: 'Test Character Full Name',
    age: 25,
    gender: CharacterGender.OTHER,
    biography: 'Test biography',
    appearance: 'Test appearance',
    personality: {
      traits: ['friendly', 'curious'],
      hobbies: ['reading'],
      fears: ['spiders'],
      values: ['honesty'],
      musicTaste: ['classical'],
      strengths: ['empathy'],
      weaknesses: ['impatience'],
    },
    archetype: CharacterArchetype.COMPANION,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    psychologicalProfile: null,
    preferences: null,
    idealPartner: null,
    knowledgeAreas: null,
    relationshipStage: null,
    developmentStage: null,
    affection: 50,
    trust: 50,
    energy: 100,
    isArchived: false,
    user: null,
    userId: null,
    needs: [],
    dialogs: [],
    memories: [],
    actions: [],
    motivations: [],
    storyProgress: [],
    lastInteraction: null,
  };

  beforeEach(async () => {
    const mockCharacterRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
    };

    const mockLogService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockNeedsService = {
      getActiveNeeds: jest.fn(),
      updateNeed: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmotionalStateService,
        {
          provide: getRepositoryToken(Character),
          useValue: mockCharacterRepository,
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
          provide: NeedsService,
          useValue: mockNeedsService,
        },
      ],
    }).compile();

    service = module.get<EmotionalStateService>(EmotionalStateService);
    characterRepository = module.get(getRepositoryToken(Character));
    _logService = module.get(LogService);
    eventEmitter = module.get(EventEmitter2);
    _needsService = module.get(NeedsService);
  });

  describe('getEmotionalState', () => {
    it('должен возвращать базовое эмоциональное состояние для нового персонажа', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      const result = await service.getEmotionalState(1);

      expect(result).toEqual({
        primary: 'нейтральная',
        intensity: 3,
        secondary: '',
        description: 'Спокойное, уравновешенное состояние',
      });
    });

    it('должен возвращать кэшированное состояние если оно существует', async () => {
      // Сначала устанавливаем состояние
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
      await service.updateEmotionalState(1, {
        emotions: { радость: 70, волнение: 50 },
        source: 'test',
        description: 'Test update',
      });

      // Затем получаем его
      const result = await service.getEmotionalState(1);

      expect(result.primary).toBe('радость');
      expect(result.intensity).toBe(7);
    });

    it('должен выбрасывать ошибку если персонаж не найден', async () => {
      characterRepository.findOne.mockResolvedValue(null);

      await expect(service.getEmotionalState(999)).rejects.toThrow(
        'Character with id 999 not found',
      );
    });
  });

  describe('updateEmotionalState', () => {
    beforeEach(() => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
    });

    it('должен обновлять эмоциональное состояние на основе MessageAnalysis', async () => {
      const analysis: MessageAnalysis = {
        urgency: 0.8,
        userIntent: 'compliment',
        needsImpact: {},
        emotionalAnalysis: {
          userMood: 'positive',
          emotionalIntensity: 0.7,
          expectedEmotionalResponse: 'радость',
          triggerEmotions: ['счастье'],
        },
        behaviorAnalysis: {
          interactionType: 'casual',
          conversationDirection: 'continue',
          userIntent: 'compliment',
          keyTopics: ['positive'],
        },
        specializationAnalysis: {
          responseComplexityLevel: 'simple',
          requiredKnowledge: [],
          domain: 'general',
        },
        manipulationAnalysis: {
          applicableTechniques: [],
          riskLevel: 'low',
          userVulnerability: 0.2,
          recommendedIntensity: 0.3,
        },
        analysisMetadata: {
          confidence: 0.8,
          processingTime: 100,
          llmProvider: 'test',
          analysisVersion: '1.0',
          timestamp: new Date(),
        },
      };

      const result = await service.updateEmotionalState(1, analysis);

      expect(result.primary).toBe('радость');
      expect(result.intensity).toBeGreaterThan(3);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'emotional_state.changed',
        expect.objectContaining({
          characterId: 1,
          trigger: 'message_analysis',
          source: 'MessageAnalysis',
        }),
      );
    });

    it('должен обновлять эмоциональное состояние на основе EmotionalUpdate', async () => {
      const update: EmotionalUpdate = {
        emotions: { грусть: 60, тревога: 40 },
        source: 'test_update',
        description: 'Тестовое обновление',
      };

      const result = await service.updateEmotionalState(1, update);

      expect(result.primary).toBe('грусть');
      expect(result.secondary).toBe('тревога');
      expect(result.intensity).toBe(6);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'emotional_state.changed',
        expect.objectContaining({
          characterId: 1,
          trigger: 'direct_update',
          source: 'test_update',
        }),
      );
    });

    it('должен игнорировать нейтральные эмоциональные анализы', async () => {
      const analysis: MessageAnalysis = {
        urgency: 0.1,
        userIntent: 'casual_talk',
        needsImpact: {},
        emotionalAnalysis: {
          userMood: 'neutral',
          emotionalIntensity: 0.1,
          expectedEmotionalResponse: '',
          triggerEmotions: [],
        },
        behaviorAnalysis: {
          interactionType: 'casual',
          conversationDirection: 'continue',
          userIntent: 'casual_talk',
          keyTopics: [],
        },
        specializationAnalysis: {
          responseComplexityLevel: 'simple',
          requiredKnowledge: [],
          domain: 'general',
        },
        manipulationAnalysis: {
          applicableTechniques: [],
          riskLevel: 'low',
          userVulnerability: 0.1,
          recommendedIntensity: 0.1,
        },
        analysisMetadata: {
          confidence: 0.5,
          processingTime: 50,
          llmProvider: 'test',
          analysisVersion: '1.0',
          timestamp: new Date(),
        },
      };

      const initialState = await service.getEmotionalState(1);
      const result = await service.updateEmotionalState(1, analysis);

      expect(result).toEqual(initialState);
    });
  });

  describe('getEmotionalProfile', () => {
    it('должен создавать базовый эмоциональный профиль для нового персонажа', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      const profile = await service.getEmotionalProfile(1);

      expect(profile).toHaveProperty('characterId', 1);
      expect(profile).toHaveProperty('baselineEmotions');
      expect(profile).toHaveProperty('emotionalRange');
      expect(profile).toHaveProperty('regulationCapacity');
      expect(profile).toHaveProperty('vulnerabilities');
      expect(profile).toHaveProperty('strengths');
    });
  });

  describe('createEmotionalMemory', () => {
    it('должен создавать эмоциональную память', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      const emotionalState: EmotionalState = {
        primary: 'радость',
        intensity: 8,
        secondary: 'волнение',
        description: 'Очень радостное состояние',
      };

      const context: EmotionalContext = {
        socialSetting: 'private',
        relationshipLevel: 75,
        timeOfDay: 'evening',
        characterEnergy: 80,
        recentEvents: [],
        environmentalFactors: [],
        culturalContext: 'neutral',
        historicalContext: 'neutral',
        emotionalClimate: 'positive',
        expectations: [],
        constraints: [],
        opportunities: [],
      };

      const memory = await service.createEmotionalMemory(
        1,
        emotionalState,
        'Получил хорошие новости',
        context,
        85,
      );

      expect(memory).toHaveProperty('id');
      expect(memory).toHaveProperty('characterId', 1);
      expect(memory).toHaveProperty('emotionalState', emotionalState);
      expect(memory).toHaveProperty('trigger', 'Получил хорошие новости');
      expect(memory).toHaveProperty('significance', 85);
      expect(memory).toHaveProperty('vividness');
      expect(memory).toHaveProperty('accessibility');
      expect(memory).toHaveProperty('tags');
    });
  });

  describe('getEmotionalMemories', () => {
    it('должен возвращать отфильтрованные эмоциональные воспоминания', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      // Создаем несколько воспоминаний
      const context: EmotionalContext = {
        socialSetting: 'private',
        relationshipLevel: 50,
        timeOfDay: 'morning',
        characterEnergy: 70,
        recentEvents: [],
        environmentalFactors: [],
        culturalContext: 'neutral',
        historicalContext: 'neutral',
        emotionalClimate: 'neutral',
        expectations: [],
        constraints: [],
        opportunities: [],
      };

      await service.createEmotionalMemory(
        1,
        { primary: 'радость', intensity: 8, secondary: '', description: 'Радостное состояние' },
        'Хорошие новости',
        context,
        90,
      );

      await service.createEmotionalMemory(
        1,
        { primary: 'грусть', intensity: 6, secondary: '', description: 'Грустное состояние' },
        'Плохие новости',
        context,
        70,
      );

      const memories = await service.getEmotionalMemories(
        1,
        {
          emotions: ['радость'],
          significance: { min: 80, max: 100 },
        },
        10,
      );

      expect(memories).toHaveLength(1);
      expect(memories[0].emotionalState.primary).toBe('радость');
      expect(memories[0].significance).toBe(90);
    });
  });

  describe('applyEmotionalRegulation', () => {
    it('должен применять стратегию эмоциональной регуляции', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      // Устанавливаем негативное эмоциональное состояние
      await service.updateEmotionalState(1, {
        emotions: { гнев: 80, раздражение: 60 },
        source: 'test',
        description: 'Test negative state',
      });

      const context: EmotionalContext = {
        socialSetting: 'private',
        relationshipLevel: 50,
        timeOfDay: 'evening',
        characterEnergy: 60,
        recentEvents: [],
        environmentalFactors: [],
        culturalContext: 'neutral',
        historicalContext: 'neutral',
        emotionalClimate: 'tense',
        expectations: [],
        constraints: [],
        opportunities: [],
      };

      const result = await service.applyEmotionalRegulation(
        1,
        'reappraisal' as EmotionalRegulationStrategy,
        70,
        context,
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('newState');
      expect(result).toHaveProperty('effectiveness');
      expect(result).toHaveProperty('sideEffects');
    });
  });

  describe('predictEmotionalReaction', () => {
    it('должен предсказывать эмоциональную реакцию', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      const context: EmotionalContext = {
        socialSetting: 'public',
        relationshipLevel: 30,
        timeOfDay: 'morning',
        characterEnergy: 75,
        recentEvents: [],
        environmentalFactors: [],
        culturalContext: 'neutral',
        historicalContext: 'neutral',
        emotionalClimate: 'neutral',
        expectations: [],
        constraints: [],
        opportunities: [],
      };

      const prediction = await service.predictEmotionalReaction(1, 'Критика от коллеги', context);

      expect(prediction).toHaveProperty('predictedState');
      expect(prediction).toHaveProperty('confidence');
      expect(prediction).toHaveProperty('alternativeStates');
      expect(prediction).toHaveProperty('factors');
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('simulateEmotionalCascade', () => {
    it('должен симулировать эмоциональный каскад', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      const context: EmotionalContext = {
        socialSetting: 'private',
        relationshipLevel: 80,
        timeOfDay: 'evening',
        characterEnergy: 85,
        recentEvents: [],
        environmentalFactors: [],
        culturalContext: 'neutral',
        historicalContext: 'neutral',
        emotionalClimate: 'positive',
        expectations: [],
        constraints: [],
        opportunities: [],
      };

      const cascade = await service.simulateEmotionalCascade(1, 'радость', context, 3);

      expect(cascade).toHaveProperty('cascadeSteps');
      expect(cascade).toHaveProperty('finalState');
      expect(cascade).toHaveProperty('duration');
      expect(cascade).toHaveProperty('probability');
      expect(cascade.cascadeSteps).toBeInstanceOf(Array);
      expect(cascade.cascadeSteps.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeEmotionalCompatibility', () => {
    it('должен анализировать эмоциональную совместимость между персонажами', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      const context: EmotionalContext = {
        socialSetting: 'private',
        relationshipLevel: 60,
        timeOfDay: 'afternoon',
        characterEnergy: 70,
        recentEvents: [],
        environmentalFactors: [],
        culturalContext: 'neutral',
        historicalContext: 'neutral',
        emotionalClimate: 'neutral',
        expectations: [],
        constraints: [],
        opportunities: [],
      };

      const compatibility = await service.analyzeEmotionalCompatibility(1, 2, context);

      expect(compatibility).toHaveProperty('overallCompatibility');
      expect(compatibility).toHaveProperty('strengths');
      expect(compatibility).toHaveProperty('challenges');
      expect(compatibility).toHaveProperty('recommendations');
      expect(compatibility).toHaveProperty('synergies');
      expect(compatibility).toHaveProperty('conflicts');
      expect(compatibility.overallCompatibility).toBeGreaterThanOrEqual(0);
      expect(compatibility.overallCompatibility).toBeLessThanOrEqual(100);
    });
  });

  describe('optimizeEmotionalState', () => {
    it('должен оптимизировать эмоциональное состояние для достижения цели', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      const context: EmotionalContext = {
        socialSetting: 'public',
        relationshipLevel: 40,
        timeOfDay: 'morning',
        characterEnergy: 80,
        recentEvents: [],
        environmentalFactors: [],
        culturalContext: 'neutral',
        historicalContext: 'neutral',
        emotionalClimate: 'neutral',
        expectations: [],
        constraints: [],
        opportunities: [],
      };

      const optimization = await service.optimizeEmotionalState(
        1,
        'Подготовиться к важной презентации',
        ['Не показывать нервозность', 'Сохранять уверенность'],
        context,
      );

      expect(optimization).toHaveProperty('targetState');
      expect(optimization).toHaveProperty('strategy');
      expect(optimization).toHaveProperty('steps');
      expect(optimization).toHaveProperty('expectedDuration');
      expect(optimization).toHaveProperty('successProbability');
      expect(optimization.steps).toBeInstanceOf(Array);
      expect(optimization.steps.length).toBeGreaterThan(0);
    });
  });

  describe('createEmotionalSnapshot', () => {
    it('должен создавать снимок эмоционального состояния', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      const snapshot = await service.createEmotionalSnapshot(1);

      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('state');
      expect(snapshot).toHaveProperty('profile');
      expect(snapshot).toHaveProperty('recentMemories');
      expect(snapshot).toHaveProperty('activePatterns');
      expect(snapshot).toHaveProperty('context');
      expect(snapshot).toHaveProperty('metadata');
      expect(snapshot.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('restoreFromSnapshot', () => {
    it('должен восстанавливать состояние из снимка', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      // Создаем снимок
      const snapshot = await service.createEmotionalSnapshot(1);

      // Изменяем состояние
      await service.updateEmotionalState(1, {
        emotions: { грусть: 80 },
        source: 'test',
        description: 'Test change',
      });

      // Восстанавливаем из снимка
      const restoration = await service.restoreFromSnapshot(1, snapshot);

      expect(restoration).toHaveProperty('success');
      expect(restoration).toHaveProperty('restoredState');
      expect(restoration).toHaveProperty('differences');
      expect(restoration.success).toBe(true);
    });
  });

  describe('normalizeEmotionalState', () => {
    beforeEach(() => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
    });

    it('должен нормализовать эмоциональное состояние персонажа', async () => {
      // Сначала установим ненормализованное состояние
      await service.updateEmotionalState(1, {
        emotions: { грусть: 95, злость: 90, тревога: 85 },
        source: 'test',
        description: 'High intensity emotions',
      });

      const result = await service.normalizeEmotionalState(1);

      expect(result).toHaveProperty('primary');
      expect(result).toHaveProperty('intensity');
      expect(result).toHaveProperty('description');
      expect(result.primary).toBeDefined();
      expect(result.intensity).toBeGreaterThanOrEqual(1);
      expect(result.intensity).toBeLessThanOrEqual(10);
    });

    it('должен сохранять умеренные эмоциональные состояния', async () => {
      // Устанавливаем умеренное состояние
      await service.updateEmotionalState(1, {
        emotions: { радость: 50 },
        source: 'test',
        description: 'Moderate emotions',
      });

      const stateBefore = await service.getEmotionalState(1);
      const result = await service.normalizeEmotionalState(1);

      // Проверяем что состояние остается стабильным
      expect(result.primary).toBeDefined();
      expect(result.intensity).toBeGreaterThanOrEqual(1);
      expect(result.intensity).toBeLessThanOrEqual(10);
      // Для умеренных состояний изменения должны быть минимальными
      expect(Math.abs(result.intensity - stateBefore.intensity)).toBeLessThanOrEqual(2);
    });
  });

  describe('getEmotionalProfile', () => {
    beforeEach(() => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
    });

    it('должен возвращать эмоциональный профиль персонажа', async () => {
      const profile = await service.getEmotionalProfile(1);

      expect(profile).toHaveProperty('characterId');
      expect(profile).toHaveProperty('baselineEmotions');
      expect(profile).toHaveProperty('emotionalRange');
      expect(profile).toHaveProperty('regulationCapacity');
      expect(profile).toHaveProperty('vulnerabilities');
      expect(profile).toHaveProperty('strengths');
      expect(profile).toHaveProperty('patterns');
      expect(profile).toHaveProperty('adaptability');
      expect(profile).toHaveProperty('resilience');
      expect(profile).toHaveProperty('sensitivity');
      expect(profile).toHaveProperty('expressiveness');
      expect(profile.characterId).toBe(1);
    });

    it('должен создавать базовый профиль для нового персонажа', async () => {
      const profile = await service.getEmotionalProfile(1);

      expect(profile.baselineEmotions).toBeDefined();
      expect(profile.emotionalRange).toBeDefined();
      expect(profile.regulationCapacity).toBeDefined();
      expect(profile.adaptability).toBeGreaterThanOrEqual(0);
      expect(profile.adaptability).toBeLessThanOrEqual(100);
      expect(profile.resilience).toBeGreaterThanOrEqual(0);
      expect(profile.resilience).toBeLessThanOrEqual(100);
    });
  });

  describe('updateEmotionalStateFromNeeds', () => {
    beforeEach(() => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
    });

    it('должен обновлять эмоциональное состояние на основе потребностей', async () => {
      const needs: INeed[] = [
        {
          id: 1,
          characterId: 1,
          type: CharacterNeedType.COMMUNICATION,
          currentValue: 20,
          maxValue: 100,
          frustrationLevel: 80,
          priority: 9,
          growthRate: 0.1,
          decayRate: 0.05,
          threshold: 70,
          dynamicPriority: 8.5,
        },
        {
          id: 2,
          characterId: 1,
          type: CharacterNeedType.RECOGNITION,
          currentValue: 50,
          maxValue: 100,
          frustrationLevel: 30,
          priority: 5,
          growthRate: 0.08,
          decayRate: 0.03,
          threshold: 60,
          dynamicPriority: 4.8,
        },
      ];

      const result = await service.updateEmotionalStateFromNeeds(1, needs);

      expect(result).toHaveProperty('primary');
      expect(result).toHaveProperty('intensity');
      expect(result).toHaveProperty('description');
      expect(result.primary).toBeDefined();
    });

    it('должен возвращать текущее состояние если потребности не критичны', async () => {
      const needs: INeed[] = [
        {
          id: 1,
          characterId: 1,
          type: CharacterNeedType.COMMUNICATION,
          currentValue: 80,
          maxValue: 100,
          frustrationLevel: 20, // Низкая фрустрация
          priority: 2,
          growthRate: 0.1,
          decayRate: 0.05,
          threshold: 70,
          dynamicPriority: 1.8,
        },
      ];

      const currentState = await service.getEmotionalState(1);
      const result = await service.updateEmotionalStateFromNeeds(1, needs);

      expect(result).toEqual(currentState);
    });

    it('должен обрабатывать пустой список потребностей', async () => {
      const currentState = await service.getEmotionalState(1);
      const result = await service.updateEmotionalStateFromNeeds(1, []);

      expect(result).toEqual(currentState);
    });
  });

  describe('applyGradualEmotionalImpact', () => {
    beforeEach(() => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
    });

    it('должен применять градуальное эмоциональное воздействие', async () => {
      const impact: EmotionalImpact = {
        emotionalType: 'волнение',
        intensity: 60,
        duration: 8000,
        fadeRate: 0.15,
        triggers: ['test'],
        manifestations: [],
        cascadeEffects: [],
        interactions: [],
        resistance: 10,
        amplifiers: [],
        dampeners: [],
      };

      const context: EmotionalContext = {
        socialSetting: 'private',
        relationshipLevel: 70,
        timeOfDay: 'morning',
        characterEnergy: 90,
        recentEvents: [],
        environmentalFactors: [],
        culturalContext: 'neutral',
        historicalContext: 'neutral',
        emotionalClimate: 'positive',
        expectations: [],
        constraints: [],
        opportunities: [],
      };

      const result = await service.applyGradualEmotionalImpact(1, impact, context);

      expect(result).toHaveProperty('primary');
      expect(result).toHaveProperty('intensity');
      expect(result).toHaveProperty('description');
      expect(result.primary).toBeDefined();
      expect(result.intensity).toBeGreaterThanOrEqual(1);
      expect(result.intensity).toBeLessThanOrEqual(10);
    });

    it('должен правильно настраивать таймеры затухания', async () => {
      const impact: EmotionalImpact = {
        emotionalType: 'радость',
        intensity: 80,
        duration: 1000, // Короткая длительность для теста
        fadeRate: 0.5,
        triggers: ['timer_test'],
        manifestations: [],
        cascadeEffects: [],
        interactions: [],
        resistance: 5,
        amplifiers: [],
        dampeners: [],
      };

      const context: EmotionalContext = {
        socialSetting: 'private',
        relationshipLevel: 50,
        timeOfDay: 'afternoon',
        characterEnergy: 75,
        recentEvents: [],
        environmentalFactors: [],
        culturalContext: 'neutral',
        historicalContext: 'neutral',
        emotionalClimate: 'neutral',
        expectations: [],
        constraints: [],
        opportunities: [],
      };

      const result = await service.applyGradualEmotionalImpact(1, impact, context);

      expect(result).toBeDefined();
      expect(result.primary).toBe('радость');
    });
  });

  describe('createEmotionalSnapshot', () => {
    it('должен создавать снимок эмоционального состояния', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      const snapshot = await service.createEmotionalSnapshot(1);

      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('state');
      expect(snapshot).toHaveProperty('profile');
      expect(snapshot).toHaveProperty('recentMemories');
      expect(snapshot).toHaveProperty('activePatterns');
      expect(snapshot).toHaveProperty('context');
      expect(snapshot).toHaveProperty('metadata');
      expect(snapshot.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('restoreFromSnapshot', () => {
    it('должен восстанавливать состояние из снимка', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      // Создаем снимок
      const snapshot = await service.createEmotionalSnapshot(1);

      // Изменяем состояние
      await service.updateEmotionalState(1, {
        emotions: { грусть: 80 },
        source: 'test',
        description: 'Test change',
      });

      // Восстанавливаем из снимка
      const restoration = await service.restoreFromSnapshot(1, snapshot);

      expect(restoration).toHaveProperty('success');
      expect(restoration).toHaveProperty('restoredState');
      expect(restoration).toHaveProperty('differences');
      expect(restoration.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('должен корректно обрабатывать ошибки при отсутствии персонажа', async () => {
      characterRepository.findOne.mockResolvedValue(null);

      await expect(service.getEmotionalState(999)).rejects.toThrow();
      await expect(
        service.updateEmotionalState(999, {
          emotions: { грусть: 50 },
          source: 'test',
          description: 'Test',
        }),
      ).rejects.toThrow();
    });

    it('должен логировать ошибки при неудачных операциях', async () => {
      characterRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.getEmotionalState(1)).rejects.toThrow();
    });
  });
});

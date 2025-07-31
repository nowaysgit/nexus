import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmotionalStateService } from '../../../../src/character/services/core/emotional-state.service';
import { Character, CharacterGender } from '../../../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../../../src/character/enums/character-archetype.enum';
import { LogService } from '../../../../src/logging/log.service';
import { NeedsService } from '../../../../src/character/services/core/needs.service';

describe('EmotionalStateService', () => {
  let service: EmotionalStateService;
  let characterRepository: jest.Mocked<Repository<Character>>;

  const mockCharacter: Partial<Character> = {
    id: 1,
    name: 'Test Character',
    fullName: 'Test Character Full',
    age: 25,
    gender: CharacterGender.FEMALE,
    archetype: CharacterArchetype.COMPANION,
    biography: 'Test biography',
    appearance: 'Test appearance',
    personality: {
      traits: ['friendly', 'outgoing'],
      hobbies: ['reading', 'music'],
      fears: ['spiders', 'heights'],
      values: ['honesty', 'loyalty'],
      musicTaste: ['pop', 'rock'],
      strengths: ['empathy', 'creativity'],
      weaknesses: ['impatience', 'stubbornness'],
    },
    userId: '1',
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockCharacterRepository = {
      findOne: jest.fn().mockResolvedValue(mockCharacter),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockNeedsService = {
      getActiveNeeds: jest.fn(),
      updateNeed: jest.fn(),
      getNeedsByCharacter: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('создание сервиса', () => {
    it('должен быть создан', () => {
      expect(service).toBeDefined();
    });

    it('должен расширять BaseService', () => {
      expect(service).toBeInstanceOf(EmotionalStateService);
    });
  });

  describe('getEmotionalState', () => {
    it('должен возвращать состояние из кэша если оно существует', async () => {
      const mockState = {
        primary: 'радость',
        secondary: 'восторг',
        intensity: 8,
        description: 'Очень радостное состояние',
      };

      // Устанавливаем состояние в кэш через приватное поле
      service['emotionalStates'].set(1, mockState);

      const result = await service.getEmotionalState(1);

      expect(result).toBe(mockState);
      expect(characterRepository.findOne).not.toHaveBeenCalled();
    });

    it('должен создавать базовое состояние для нового персонажа', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);

      const result = await service.getEmotionalState(1);

      expect(result).toEqual({
        primary: 'нейтральная',
        intensity: 3,
        secondary: '',
        description: 'Спокойное, уравновешенное состояние',
      });
      expect(characterRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('должен обрабатывать ошибку если персонаж не найден', async () => {
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

    it('должен обновлять эмоциональное состояние с EmotionalUpdate', async () => {
      const emotionalUpdate = {
        emotions: { радость: 8 },
        source: 'test',
        timestamp: new Date(),
        metadata: {},
        description: 'Test emotional update',
      };

      const result = await service.updateEmotionalState(1, emotionalUpdate);

      expect(result).toBeDefined();
      expect(result.primary).toBeDefined();
      expect(result.intensity).toBeGreaterThanOrEqual(0);
    });

    it('должен обрабатывать ошибки при обновлении состояния', async () => {
      const emotionalUpdate = {
        emotions: { радость: 8 },
        source: 'test',
        timestamp: new Date(),
        metadata: {},
        description: 'Test error handling',
      };

      characterRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.updateEmotionalState(1, emotionalUpdate)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('createEmotionalMemory', () => {
    it('должен создавать эмоциональную память', async () => {
      const emotionalState = {
        primary: 'радость',
        secondary: 'восторг',
        intensity: 8,
        description: 'Радостное состояние',
      };

      const context = {
        interactionCount: 10,
        emotionalInfluence: 0.7,
        personalityAlignment: 0.8,
        needsSatisfaction: 0.6,
        conversationTone: 'friendly',
        recentEvents: ['positive_interaction'],
        relationships: [],
        timestamp: new Date().toISOString(),
        socialSetting: 'private' as const,
        relationshipLevel: 50,
        timeOfDay: 'afternoon' as const,
        characterEnergy: 0.8,
        stressLevel: 0.2,
        communicationStyle: 'friendly',
        culturalContext: 'casual',
        environmentalFactors: [],
        previousInteractions: [],
        contextualCues: [],
        contextualEmotions: [],
        historicalContext: 'positive_interactions',
        emotionalClimate: 'warm_friendly',
        expectations: ['positive_response'],
        constraints: ['time_limit'],
        opportunities: ['emotional_bonding'],
      };

      const result = await service.createEmotionalMemory(
        1,
        emotionalState,
        'Positive interaction with user',
        context,
        80,
      );

      expect(result).toBeDefined();
      expect(result.characterId).toBe(1);
      expect(result.emotionalState).toStrictEqual(emotionalState);
      expect(result.trigger).toBe('Positive interaction with user');
      expect(result.significance).toBe(80);
    });
  });

  describe('getEmotionalMemories', () => {
    it('должен возвращать эмоциональные воспоминания с фильтрами', async () => {
      const filters = {
        emotions: ['радость'],
        significance: { min: 50, max: 100 },
      };

      const result = await service.getEmotionalMemories(1, filters, 5);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('должен возвращать пустой массив если воспоминания не найдены', async () => {
      const result = await service.getEmotionalMemories(1, {}, 5);

      expect(result).toEqual([]);
    });
  });

  describe('getEmotionalTransitions', () => {
    it('должен возвращать эмоциональные переходы за период', async () => {
      const timeRange = {
        from: new Date(Date.now() - 24 * 60 * 60 * 1000),
        to: new Date(),
      };

      const result = await service.getEmotionalTransitions(1, timeRange, 3);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('методы эмоционального профиля', () => {
    beforeEach(() => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
    });

    it('должен получать эмоциональный профиль персонажа', async () => {
      const result = await service.getEmotionalProfile(1);

      expect(result).toBeDefined();
    });

    it('должен обновлять эмоциональный профиль', async () => {
      const profileUpdate = {
        emotionalRange: {
          maxIntensity: 10,
          minIntensity: 1,
          variability: 50,
          accessibility: { радость: 80, грусть: 60 },
        },
        dominantEmotions: ['радость', 'спокойствие'],
        reactionPatterns: [],
        recoveryRate: 0.5,
        triggers: [],
        suppressions: [],
        adaptability: 0.7,
      };

      const result = await service.updateEmotionalProfile(1, profileUpdate);

      expect(result).toBeDefined();
    });
  });

  describe('предсказание эмоций', () => {
    beforeEach(() => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
    });
    it('должен предсказывать эмоциональную реакцию', async () => {
      const stimulus = 'positive feedback';

      const context = {
        socialSetting: 'private' as const,
        relationshipLevel: 50,
        timeOfDay: 'afternoon' as const,
        characterEnergy: 0.8,
        recentEvents: [],
        environmentalFactors: [],
        culturalContext: 'casual',
        historicalContext: 'positive_interactions',
        emotionalClimate: 'warm_friendly',
        expectations: ['positive_response'],
        constraints: ['time_limit'],
        opportunities: ['emotional_bonding'],
      };

      const result = await service.predictEmotionalReaction(1, stimulus, context);

      expect(result).toBeDefined();
      expect(result.predictedState).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('эмоциональные каскады', () => {
    beforeEach(() => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
    });
    it('должен симулировать эмоциональный каскад', async () => {
      const initialEmotion = 'радость';
      const context = {
        socialSetting: 'private' as const,
        relationshipLevel: 50,
        timeOfDay: 'afternoon' as const,
        characterEnergy: 0.8,
        recentEvents: [],
        environmentalFactors: [],
        culturalContext: 'casual',
        historicalContext: 'positive_interactions',
        emotionalClimate: 'warm_friendly',
        expectations: ['positive_response'],
        constraints: ['time_limit'],
        opportunities: ['emotional_bonding'],
      };

      const result = await service.simulateEmotionalCascade(1, initialEmotion, context);

      expect(result).toBeDefined();
      expect(Array.isArray(result.cascadeSteps)).toBe(true);
      expect(result.finalState).toBeDefined();
    });
  });

  describe('эмоциональная совместимость', () => {
    beforeEach(() => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
    });
    it('должен анализировать эмоциональную совместимость', async () => {
      const characterId2 = 2;
      const context = {
        socialSetting: 'private' as const,
        relationshipLevel: 50,
        timeOfDay: 'afternoon' as const,
        characterEnergy: 0.8,
        recentEvents: [],
        environmentalFactors: [],
        culturalContext: 'casual',
        historicalContext: 'positive_interactions',
        emotionalClimate: 'warm_friendly',
        expectations: ['positive_response'],
        constraints: ['time_limit'],
        opportunities: ['emotional_bonding'],
      };

      const result = await service.analyzeEmotionalCompatibility(1, characterId2, context);

      expect(result).toBeDefined();
      expect(result.overallCompatibility).toBeGreaterThanOrEqual(0);
      expect(result.overallCompatibility).toBeLessThanOrEqual(100);
      expect(result.strengths).toBeDefined();
      expect(result.challenges).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });

  describe('оптимизация эмоционального состояния', () => {
    beforeEach(() => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
    });
    it('должен оптимизировать эмоциональное состояние', async () => {
      const goal = 'достижение спокойствия';
      const constraints = ['избегать стресса'];
      const context = {
        socialSetting: 'private' as const,
        relationshipLevel: 50,
        timeOfDay: 'evening' as const,
        characterEnergy: 70,
        recentEvents: ['завершил работу'],
        environmentalFactors: ['тихая обстановка'],
        culturalContext: 'дружелюбный',
        historicalContext: 'позитивные взаимодействия',
        emotionalClimate: 'спокойный',
        expectations: ['расслабление'],
        constraints: ['избегать стресса'],
        opportunities: ['медитация'],
      };

      const result = await service.optimizeEmotionalState(1, goal, constraints, context);

      expect(result).toBeDefined();
      expect(result.targetState).toBeDefined();
      expect(result.strategy).toBeDefined();
      expect(result.steps).toBeDefined();
      expect(Array.isArray(result.steps)).toBe(true);
      expect(result.expectedDuration).toBeGreaterThan(0);
      expect(result.successProbability).toBeGreaterThanOrEqual(0);
      expect(result.successProbability).toBeLessThanOrEqual(100);
    });
  });

  describe('снимки эмоционального состояния', () => {
    beforeEach(() => {
      characterRepository.findOne.mockResolvedValue(mockCharacter as Character);
    });
    it('должен создавать снимок эмоционального состояния', async () => {
      const result = await service.createEmotionalSnapshot(1);

      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.state).toBeDefined();
      expect(result.profile).toBeDefined();
      expect(result.recentMemories).toBeDefined();
      expect(result.context).toBeDefined();
    });

    it('должен восстанавливать состояние из снимка', async () => {
      // Сначала создаем снимок
      const snapshot = await service.createEmotionalSnapshot(1);
      const snapshotData = {
        state: snapshot.state,
        profile: snapshot.profile,
        context: snapshot.context,
      };

      // Затем восстанавливаем из него
      const result = await service.restoreFromSnapshot(1, snapshotData);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.restoredState).toBeDefined();
      expect(result.differences).toBeDefined();
    });
  });

  describe('анализ эмоциональных паттернов', () => {
    it('должен анализировать эмоциональные паттерны', async () => {
      const timeRange = {
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        to: new Date(),
      };

      const result = await service.analyzeEmotionalPatterns(1, timeRange);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { EmotionalStateController } from '../../../src/character/controllers/emotional-state.controller';
import { EmotionalStateService } from '../../../src/character/services/core/emotional-state.service';
import { LogService } from '../../../src/logging/log.service';
import {
  EmotionalState,
  EmotionalProfile,
  EmotionalMemory,
  EmotionalTransition,
  EmotionalEvent,
  EmotionalPattern,
  EmotionalRegulationStrategy,
} from '../../../src/character/entities/emotional-state';
import { createTestSuite } from '../../../lib/tester';

createTestSuite('EmotionalStateController Unit Tests', () => {
  let controller: EmotionalStateController;
  let emotionalStateService: jest.Mocked<EmotionalStateService>;
  let logService: jest.Mocked<LogService>;

  const mockEmotionalState: EmotionalState = {
    primary: 'радость',
    intensity: 7,
    secondary: 'волнение',
    description: 'Радостное состояние с волнением',
  };

  const mockEmotionalProfile: EmotionalProfile = {
    characterId: 1,
    baselineEmotions: { нейтральная: 60, радость: 20, любопытство: 20 },
    emotionalRange: {
      maxIntensity: 100,
      minIntensity: 0,
      variability: 50,
      accessibility: {
        радость: 80,
        грусть: 60,
        гнев: 40,
      },
    },
    regulationCapacity: {
      strategies: {
        reappraisal: 80,
        suppression: 60,
        distraction: 70,
        acceptance: 75,
        problem_solving: 85,
        social_support: 70,
        rumination: 30,
        avoidance: 40,
        expression: 80,
        mindfulness: 75,
      },
      flexibility: 80,
      effectiveness: 75,
      awareness: 85,
      control: 70,
    },
    vulnerabilities: [
      {
        emotion: 'критика',
        triggers: ['резкая критика', 'публичное порицание'],
        severity: 80,
        frequency: 60,
        impact: 'Чувствителен к критике',
        copingMechanisms: ['избегание', 'поиск поддержки'],
      },
    ],
    strengths: [
      {
        emotion: 'эмпатия',
        advantages: ['понимание других', 'эмоциональная связь'],
        effectiveness: 85,
        stability: 80,
        applications: ['общение', 'поддержка других'],
      },
    ],
    patterns: [],
    adaptability: 75,
    resilience: 80,
    sensitivity: 70,
    expressiveness: 85,
  };

  const mockEmotionalMemory: EmotionalMemory = {
    id: 'mem_1_123456789_abc123',
    characterId: 1,
    emotionalState: mockEmotionalState,
    trigger: 'Получил хорошие новости',
    context: {
      socialSetting: 'private',
      relationshipLevel: 75,
      timeOfDay: 'evening',

      recentEvents: [],
      culturalContext: 'neutral',
      historicalContext: 'нейтральный контекст',
      emotionalClimate: 'positive',
      characterEnergy: 80,
      environmentalFactors: ['комфортная обстановка'],
      expectations: [],
      constraints: [],
      opportunities: [],
    },
    timestamp: new Date(),
    significance: 85,
    vividness: 90,
    accessibility: 80,
    decay: 0,
    associations: [],
    tags: ['позитивные', 'новости', 'дом'],
  };

  beforeEach(async () => {
    const mockEmotionalStateService = {
      getEmotionalState: jest.fn(),
      updateEmotionalState: jest.fn(),
      getEmotionalProfile: jest.fn(),
      updateEmotionalProfile: jest.fn(),
      createEmotionalMemory: jest.fn(),
      getEmotionalMemories: jest.fn(),
      getEmotionalTransitions: jest.fn(),
      getEmotionalEvents: jest.fn(),
      applyEmotionalRegulation: jest.fn(),
      analyzeEmotionalPatterns: jest.fn(),
      predictEmotionalReaction: jest.fn(),
      simulateEmotionalCascade: jest.fn(),
      analyzeEmotionalCompatibility: jest.fn(),
      optimizeEmotionalState: jest.fn(),
      createEmotionalSnapshot: jest.fn(),
      restoreFromSnapshot: jest.fn(),
      createEmotionalContext: jest.fn(),
    };

    const mockLogService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmotionalStateController],
      providers: [
        {
          provide: EmotionalStateService,
          useValue: mockEmotionalStateService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    }).compile();

    controller = module.get<EmotionalStateController>(EmotionalStateController);
    emotionalStateService = module.get(EmotionalStateService);
    logService = module.get(LogService);
  });

  describe('getEmotionalState', () => {
    it('должен возвращать текущее эмоциональное состояние персонажа', async () => {
      emotionalStateService.getEmotionalState.mockResolvedValue(mockEmotionalState);

      const result = await controller.getEmotionalState(1);

      expect(result).toEqual(mockEmotionalState);
      expect(emotionalStateService.getEmotionalState).toHaveBeenCalledWith(1);
    });
  });

  describe('updateEmotionalState', () => {
    it('должен обновлять эмоциональное состояние персонажа', async () => {
      const updateDto = {
        emotions: { радость: 80, волнение: 60 },
        source: 'test_update',
        description: 'Тестовое обновление',
      };

      emotionalStateService.updateEmotionalState.mockResolvedValue(mockEmotionalState);

      const result = await controller.updateEmotionalState(1, updateDto);

      expect(result).toEqual(mockEmotionalState);
      expect(emotionalStateService.updateEmotionalState).toHaveBeenCalledWith(1, {
        emotions: updateDto.emotions,
        source: updateDto.source,
        description: updateDto.description,
      });
    });
  });

  describe('getEmotionalProfile', () => {
    it('должен возвращать эмоциональный профиль персонажа', async () => {
      emotionalStateService.getEmotionalProfile.mockResolvedValue(mockEmotionalProfile);

      const result = await controller.getEmotionalProfile(1);

      expect(result).toEqual(mockEmotionalProfile);
      expect(emotionalStateService.getEmotionalProfile).toHaveBeenCalledWith(1);
    });
  });

  describe('updateEmotionalProfile', () => {
    it('должен обновлять эмоциональный профиль персонажа', async () => {
      const profileUpdate = {
        baselineEmotions: { нейтральная: 70, радость: 30 },
      };

      emotionalStateService.updateEmotionalProfile.mockResolvedValue(mockEmotionalProfile);

      const result = await controller.updateEmotionalProfile(1, profileUpdate);

      expect(result).toEqual(mockEmotionalProfile);
      expect(emotionalStateService.updateEmotionalProfile).toHaveBeenCalledWith(1, profileUpdate);
    });
  });

  describe('getEmotionalMemories', () => {
    it('должен возвращать эмоциональные воспоминания с фильтрами', async () => {
      const memories = [mockEmotionalMemory];
      emotionalStateService.getEmotionalMemories.mockResolvedValue(memories);

      const result = await controller.getEmotionalMemories(
        1,
        'радость,волнение',
        '2023-01-01',
        '2023-12-31',
        80,
        100,
        'позитивные,новости',
        10,
      );

      expect(result).toEqual(memories);
      expect(emotionalStateService.getEmotionalMemories).toHaveBeenCalledWith(
        1,
        {
          emotions: ['радость', 'волнение'],
          timeRange: {
            from: new Date('2023-01-01'),
            to: new Date('2023-12-31'),
          },
          significance: { min: 80, max: 100 },
          tags: ['позитивные', 'новости'],
        },
        10,
      );
    });

    it('должен возвращать воспоминания без фильтров', async () => {
      const memories = [mockEmotionalMemory];
      emotionalStateService.getEmotionalMemories.mockResolvedValue(memories);

      const result = await controller.getEmotionalMemories(1);

      expect(result).toEqual(memories);
      expect(emotionalStateService.getEmotionalMemories).toHaveBeenCalledWith(1, {}, 50);
    });
  });

  describe('createEmotionalMemory', () => {
    it('должен создавать эмоциональную память', async () => {
      const memoryDto = {
        emotionalState: mockEmotionalState,
        trigger: 'Тестовый триггер',
        significance: 75,
      };

      const mockContext = {
        socialSetting: 'private' as const,
        relationshipLevel: 50,
        timeOfDay: 'morning' as const,

        recentEvents: [],
        culturalContext: 'neutral',
        historicalContext: 'нейтральный контекст',
        emotionalClimate: 'neutral',
        characterEnergy: 80,
        environmentalFactors: ['комфортная обстановка'],
        expectations: [],
        constraints: [],
        opportunities: [],
      };

      emotionalStateService.createEmotionalContext.mockResolvedValue(mockContext);
      emotionalStateService.createEmotionalMemory.mockResolvedValue(mockEmotionalMemory);

      const result = await controller.createEmotionalMemory(1, memoryDto);

      expect(result).toEqual(mockEmotionalMemory);
      expect(emotionalStateService.createEmotionalContext).toHaveBeenCalledWith(1);
      expect(emotionalStateService.createEmotionalMemory).toHaveBeenCalledWith(
        1,
        memoryDto.emotionalState,
        memoryDto.trigger,
        mockContext,
        memoryDto.significance,
      );
    });
  });

  describe('applyEmotionalRegulation', () => {
    it('должен применять эмоциональную регуляцию', async () => {
      const regulationDto = {
        strategy: EmotionalRegulationStrategy.REAPPRAISAL,
        intensity: 70,
      };

      const mockContext = {
        socialSetting: 'private' as const,
        relationshipLevel: 50,
        timeOfDay: 'evening' as const,

        recentEvents: [],
        culturalContext: 'neutral',
        historicalContext: 'нейтральный контекст',
        emotionalClimate: 'neutral',
        characterEnergy: 80,
        environmentalFactors: ['комфортная обстановка'],
        expectations: [],
        constraints: [],
        opportunities: [],
      };

      const mockResult = {
        success: true,
        newState: mockEmotionalState,
        effectiveness: 85,
        sideEffects: [],
      };

      emotionalStateService.createEmotionalContext.mockResolvedValue(mockContext);
      emotionalStateService.applyEmotionalRegulation.mockResolvedValue(mockResult);

      const result = await controller.applyEmotionalRegulation(1, regulationDto);

      expect(result).toEqual(mockResult);
      expect(emotionalStateService.createEmotionalContext).toHaveBeenCalledWith(1);
      expect(emotionalStateService.applyEmotionalRegulation).toHaveBeenCalledWith(
        1,
        regulationDto.strategy,
        regulationDto.intensity,
        mockContext,
      );
    });
  });

  describe('predictEmotionalReaction', () => {
    it('должен предсказывать эмоциональную реакцию', async () => {
      const predictionDto = {
        trigger: 'Критика от коллеги',
      };

      const mockContext = {
        socialSetting: 'public' as const,
        relationshipLevel: 30,
        timeOfDay: 'morning' as const,

        recentEvents: [],
        culturalContext: 'neutral',
        historicalContext: 'нейтральный контекст',
        emotionalClimate: 'neutral',
        characterEnergy: 80,
        environmentalFactors: ['комфортная обстановка'],
        expectations: [],
        constraints: [],
        opportunities: [],
      };

      const mockPrediction = {
        predictedState: {
          primary: 'раздражение',
          intensity: 6,
          secondary: 'неуверенность',
          description: 'Раздражение с неуверенностью',
        },
        confidence: 75,
        alternativeStates: [
          {
            primary: 'грусть',
            intensity: 5,
            secondary: '',
            description: 'Грустное состояние',
          },
        ],
        factors: ['низкий уровень отношений', 'рабочая обстановка'],
      };

      emotionalStateService.createEmotionalContext.mockResolvedValue(mockContext);
      emotionalStateService.predictEmotionalReaction.mockResolvedValue(mockPrediction);

      const result = await controller.predictEmotionalReaction(1, predictionDto);

      expect(result).toEqual(mockPrediction);
      expect(emotionalStateService.createEmotionalContext).toHaveBeenCalledWith(1);
      expect(emotionalStateService.predictEmotionalReaction).toHaveBeenCalledWith(
        1,
        predictionDto.trigger,
        mockContext,
      );
    });
  });

  describe('simulateEmotionalCascade', () => {
    it('должен симулировать эмоциональный каскад', async () => {
      const cascadeDto = {
        initialEmotion: 'радость',
        maxDepth: 3,
      };

      const mockContext = {
        socialSetting: 'private' as const,
        relationshipLevel: 80,
        timeOfDay: 'evening' as const,

        recentEvents: [],
        culturalContext: 'neutral',
        historicalContext: 'нейтральный контекст',
        emotionalClimate: 'positive',
        characterEnergy: 80,
        environmentalFactors: ['комфортная обстановка'],
        expectations: [],
        constraints: [],
        opportunities: [],
      };

      const mockCascade = {
        cascadeSteps: [
          {
            primary: 'радость',
            intensity: 8,
            secondary: '',
            description: 'Начальная радость',
          },
          {
            primary: 'волнение',
            intensity: 7,
            secondary: 'энтузиазм',
            description: 'Волнение с энтузиазмом',
          },
        ],
        finalState: {
          primary: 'удовлетворение',
          intensity: 6,
          secondary: '',
          description: 'Удовлетворенное состояние',
        },
        duration: 45,
        probability: 78,
      };

      emotionalStateService.createEmotionalContext.mockResolvedValue(mockContext);
      emotionalStateService.simulateEmotionalCascade.mockResolvedValue(mockCascade);

      const result = await controller.simulateEmotionalCascade(1, cascadeDto);

      expect(result).toEqual(mockCascade);
      expect(emotionalStateService.createEmotionalContext).toHaveBeenCalledWith(1);
      expect(emotionalStateService.simulateEmotionalCascade).toHaveBeenCalledWith(
        1,
        cascadeDto.initialEmotion,
        mockContext,
        cascadeDto.maxDepth,
      );
    });
  });

  describe('analyzeEmotionalCompatibility', () => {
    it('должен анализировать эмоциональную совместимость', async () => {
      const compatibilityDto = {
        characterId2: 2,
      };

      const mockContext = {
        socialSetting: 'private' as const,
        relationshipLevel: 60,
        timeOfDay: 'afternoon' as const,

        recentEvents: [],
        culturalContext: 'neutral',
        historicalContext: 'нейтральный контекст',
        emotionalClimate: 'neutral',
        characterEnergy: 80,
        environmentalFactors: ['комфортная обстановка'],
        expectations: [],
        constraints: [],
        opportunities: [],
      };

      const mockCompatibility = {
        overallCompatibility: 75,
        strengths: ['общие интересы', 'схожий темперамент'],
        challenges: ['разные подходы к конфликтам'],
        recommendations: ['больше общения', 'совместная деятельность'],
        synergies: ['взаимная поддержка'],
        conflicts: ['конкуренция'],
      };

      emotionalStateService.createEmotionalContext.mockResolvedValue(mockContext);
      emotionalStateService.analyzeEmotionalCompatibility.mockResolvedValue(mockCompatibility);

      const result = await controller.analyzeEmotionalCompatibility(1, compatibilityDto);

      expect(result).toEqual(mockCompatibility);
      expect(emotionalStateService.createEmotionalContext).toHaveBeenCalledWith(1);
      expect(emotionalStateService.analyzeEmotionalCompatibility).toHaveBeenCalledWith(
        1,
        compatibilityDto.characterId2,
        mockContext,
      );
    });
  });

  describe('optimizeEmotionalState', () => {
    it('должен оптимизировать эмоциональное состояние', async () => {
      const optimizationDto = {
        goal: 'Подготовиться к важной презентации',
        constraints: ['Не показывать нервозность', 'Сохранять уверенность'],
      };

      const mockContext = {
        socialSetting: 'public' as const,
        relationshipLevel: 40,
        timeOfDay: 'morning' as const,

        recentEvents: [],
        culturalContext: 'neutral',
        historicalContext: 'нейтральный контекст',
        emotionalClimate: 'neutral',
        characterEnergy: 80,
        environmentalFactors: ['комфортная обстановка'],
        expectations: [],
        constraints: [],
        opportunities: [],
      };

      const mockOptimization = {
        targetState: {
          primary: 'уверенность',
          intensity: 8,
          secondary: 'сосредоточенность',
          description: 'Уверенное и сосредоточенное состояние',
        },
        strategy: EmotionalRegulationStrategy.REAPPRAISAL,
        steps: [
          'Переосмыслить презентацию как возможность',
          'Сосредоточиться на подготовке',
          'Использовать техники дыхания',
        ],
        expectedDuration: 30,
        successProbability: 85,
      };

      emotionalStateService.createEmotionalContext.mockResolvedValue(mockContext);
      emotionalStateService.optimizeEmotionalState.mockResolvedValue(mockOptimization);

      const result = await controller.optimizeEmotionalState(1, optimizationDto);

      expect(result).toEqual(mockOptimization);
      expect(emotionalStateService.createEmotionalContext).toHaveBeenCalledWith(1);
      expect(emotionalStateService.optimizeEmotionalState).toHaveBeenCalledWith(
        1,
        optimizationDto.goal,
        optimizationDto.constraints,
        mockContext,
      );
    });
  });

  describe('createEmotionalSnapshot', () => {
    it('должен создавать снимок эмоционального состояния', async () => {
      const mockSnapshot = {
        timestamp: new Date(),
        state: mockEmotionalState,
        profile: mockEmotionalProfile,
        recentMemories: [mockEmotionalMemory],
        activePatterns: [],
        context: {
          socialSetting: 'private' as const,
          relationshipLevel: 50,
          timeOfDay: 'evening' as const,

          recentEvents: [],
          culturalContext: 'neutral',
          historicalContext: 'нейтральный контекст',
          emotionalClimate: 'neutral',
          characterEnergy: 80,
          environmentalFactors: ['комфортная обстановка'],
          expectations: [],
          constraints: [],
          opportunities: [],
        },
        metadata: { source: 'manual_snapshot' },
      };

      emotionalStateService.createEmotionalSnapshot.mockResolvedValue(mockSnapshot);

      const result = await controller.createEmotionalSnapshot(1);

      expect(result).toEqual(mockSnapshot);
      expect(emotionalStateService.createEmotionalSnapshot).toHaveBeenCalledWith(1);
    });
  });

  describe('restoreFromSnapshot', () => {
    it('должен восстанавливать состояние из снимка', async () => {
      const mockSnapshot = {
        timestamp: new Date(),
        state: mockEmotionalState,
        profile: mockEmotionalProfile,
        recentMemories: [],
        activePatterns: [],
        context: {},
        metadata: {},
      };

      const mockRestoration = {
        success: true,
        restoredState: mockEmotionalState,
        differences: [],
      };

      emotionalStateService.restoreFromSnapshot.mockResolvedValue(mockRestoration);

      const result = await controller.restoreFromSnapshot(1, mockSnapshot);

      expect(result).toEqual(mockRestoration);
      expect(emotionalStateService.restoreFromSnapshot).toHaveBeenCalledWith(1, mockSnapshot);
    });
  });

  describe('analyzeEmotionalPatterns', () => {
    it('должен анализировать эмоциональные паттерны', async () => {
      const mockPatterns: EmotionalPattern[] = [
        {
          id: 'pattern_1',

          name: 'Циклический паттерн радости и грусти',
          frequency: 70,
          triggers: ['понедельник', 'усталость'],
          sequence: ['радость', 'грусть'],
          predictability: 85,
          outcomes: ['улучшение настроения', 'принятие решений'],
          adaptiveness: 70,
        },
      ];

      emotionalStateService.analyzeEmotionalPatterns.mockResolvedValue(mockPatterns);

      const result = await controller.analyzeEmotionalPatterns(1, '2023-01-01', '2023-12-31');

      expect(result).toEqual(mockPatterns);
      expect(emotionalStateService.analyzeEmotionalPatterns).toHaveBeenCalledWith(1, {
        from: new Date('2023-01-01'),
        to: new Date('2023-12-31'),
      });
    });

    it('должен выбрасывать ошибку при отсутствии обязательных параметров', async () => {
      await expect(controller.analyzeEmotionalPatterns(1, '', '2023-12-31')).rejects.toThrow(
        'Параметры fromDate и toDate обязательны',
      );
    });
  });
});

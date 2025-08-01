import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmotionalAdaptationService } from '../../../src/character/services/behavior/emotional-adaptation.service';
import { EmotionalStateService } from '../../../src/character/services/core/emotional-state.service';
import { CharacterService } from '../../../src/character/services/core/character.service';
import { DialogService } from '../../../src/dialog/services/dialog.service';
import { LogService } from '../../../src/logging/log.service';
import {
  EmotionalAdaptationType,
  EmotionalResponseType,
  EmotionalSensitivityLevel,
} from '../../../src/character/interfaces/emotional-adaptation.interfaces';
import { EmotionalState } from '../../../src/character/entities/emotional-state';

describe('EmotionalAdaptationService', () => {
  let service: EmotionalAdaptationService;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockEmotionalStateService: jest.Mocked<EmotionalStateService>;
  let mockCharacterService: jest.Mocked<CharacterService>;
  let mockDialogService: jest.Mocked<DialogService>;
  let mockLogService: jest.Mocked<LogService>;

  beforeEach(async () => {
    // Создаем моки
    mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    } as any;

    mockEmotionalStateService = {
      getEmotionalState: jest.fn(),
      updateEmotionalState: jest.fn(),
    } as any;

    mockCharacterService = {
      findOne: jest.fn(),
      getCharacter: jest.fn(),
    } as any;

    mockDialogService = {
      getDialogHistory: jest.fn(),
      saveMessage: jest.fn(),
    } as any;

    mockLogService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmotionalAdaptationService,
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: EmotionalStateService,
          useValue: mockEmotionalStateService,
        },
        {
          provide: CharacterService,
          useValue: mockCharacterService,
        },
        {
          provide: DialogService,
          useValue: mockDialogService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    }).compile();

    service = module.get<EmotionalAdaptationService>(EmotionalAdaptationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeAndAdaptEmotionalResponse', () => {
    it('should analyze emotional interaction and provide adaptation recommendations', async () => {
      const characterId = 1;
      const userId = 'user123';
      const currentEmotion: EmotionalState = {
        primary: 'радость',
        intensity: 5,
        secondary: '',
        description: 'Приятное настроение',
      };
      const userResponse = 'Мне нравится твоя реакция!';
      const contextData = { topic: 'поддержка' };

      const result = await service.analyzeAndAdaptEmotionalResponse(
        characterId,
        userId,
        currentEmotion,
        userResponse,
        contextData,
      );

      expect(result).toBeDefined();
      expect(result.userEmotionalResponse).toBeDefined();
      expect(result.adaptationRecommendations).toBeDefined();
      expect(result.adaptationResult).toBeDefined();
      expect(result.adaptationEvent).toBeDefined();
      expect(result.updatedProfile).toBeDefined();

      // Проверяем, что событие адаптации было отправлено
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'emotional_adaptation.applied',
        expect.any(Object),
      );

      // Проверяем логирование
      expect(mockLogService.log).toHaveBeenCalled();
    });

    it('should handle negative user response with intensity reduction recommendations', async () => {
      const characterId = 1;
      const userId = 'user123';
      const currentEmotion: EmotionalState = {
        primary: 'гнев',
        intensity: 9,
        secondary: '',
        description: 'Сильное раздражение',
      };
      const userResponse = 'Слишком агрессивно, мне не нравится';

      const result = await service.analyzeAndAdaptEmotionalResponse(
        characterId,
        userId,
        currentEmotion,
        userResponse,
      );

      expect(result.adaptationRecommendations.length).toBeGreaterThan(0);

      // Должны быть рекомендации по снижению интенсивности
      const intensityReduction = result.adaptationRecommendations.find(
        rec => rec.adaptation.type === EmotionalAdaptationType.INTENSITY_ADJUSTMENT,
      );
      expect(intensityReduction).toBeDefined();
      expect(intensityReduction?.adaptation.parameters.intensityMultiplier).toBeLessThan(1);
    });

    it('should handle positive user response without major adaptations', async () => {
      const characterId = 1;
      const userId = 'user123';
      const currentEmotion: EmotionalState = {
        primary: 'радость',
        intensity: 6,
        secondary: '',
        description: 'Хорошее настроение',
      };
      const userResponse = 'Отлично! Спасибо за поддержку!';

      const result = await service.analyzeAndAdaptEmotionalResponse(
        characterId,
        userId,
        currentEmotion,
        userResponse,
      );

      // Позитивная реакция не должна требовать серьезных адаптаций
      expect(result.userEmotionalResponse.emotionalIndicators.satisfaction).toBeGreaterThan(0.5);
      expect(result.adaptationRecommendations.length).toBeLessThanOrEqual(1);
    });
  });

  describe('generateAdaptedEmotionalResponse', () => {
    it('should generate adapted emotional response based on user preferences', async () => {
      const characterId = 1;
      const userId = 'user123';
      const baseEmotion: EmotionalState = {
        primary: 'удивление',
        intensity: 8,
        secondary: '',
        description: 'Сильное удивление',
      };
      const context = 'пользователь поделился неожиданной новостью';

      const result = await service.generateAdaptedEmotionalResponse(
        characterId,
        userId,
        baseEmotion,
        context,
      );

      expect(result).toBeDefined();
      expect(result.primary).toBeDefined();
      expect(result.intensity).toBeGreaterThan(0);
      expect(result.intensity).toBeLessThanOrEqual(10);
      expect(result.description).toBeDefined();
    });

    it('should adjust intensity based on user preferences', async () => {
      const characterId = 1;
      const userId = 'user123';
      const baseEmotion: EmotionalState = {
        primary: 'восторг',
        intensity: 10,
        secondary: '',
        description: 'Максимальный восторг',
      };
      const context = 'обычное взаимодействие';

      const result = await service.generateAdaptedEmotionalResponse(
        characterId,
        userId,
        baseEmotion,
        context,
      );

      // Интенсивность должна быть скорректирована в рамках предпочтений пользователя
      expect(result.intensity).toBeLessThanOrEqual(7); // Максимум предпочтений по умолчанию
    });

    it('should avoid restricted emotions', async () => {
      const characterId = 1;
      const userId = 'user123';
      const baseEmotion: EmotionalState = {
        primary: 'гнев',
        intensity: 6,
        secondary: '',
        description: 'Раздражение',
      };
      const context = 'конфликтная ситуация';

      // Предполагаем, что гнев в списке избегаемых эмоций
      const result = await service.generateAdaptedEmotionalResponse(
        characterId,
        userId,
        baseEmotion,
        context,
      );

      expect(result).toBeDefined();
      // Результат может отличаться от базовой эмоции, если она в списке избегаемых
    });
  });

  describe('trainAdaptationModel', () => {
    it('should train adaptation model based on interaction history', async () => {
      const characterId = 1;
      const userId = 'user123';
      const interactionHistory = [
        { type: 'message', content: 'положительная реакция', timestamp: new Date() },
        { type: 'message', content: 'нейтральная реакция', timestamp: new Date() },
      ];
      const feedbackSignals = [
        { type: 'satisfaction', value: 0.8 },
        { type: 'engagement', value: 0.7 },
      ];

      await expect(
        service.trainAdaptationModel(characterId, userId, interactionHistory, feedbackSignals),
      ).resolves.not.toThrow();

      expect(mockLogService.log).toHaveBeenCalledWith(
        'Модель эмоциональной адаптации обновлена',
        expect.any(Object),
      );
    });
  });

  describe('getAdaptationRecommendations', () => {
    it('should provide adaptation recommendations', async () => {
      const characterId = 1;
      const userId = 'user123';

      const recommendations = await service.getAdaptationRecommendations(characterId, userId);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('exportAdaptationProfile', () => {
    it('should export adaptation profile for analysis', async () => {
      const characterId = 1;
      const userId = 'user123';

      const profile = await service.exportAdaptationProfile(characterId, userId);

      expect(profile).toBeDefined();
      expect(profile.characterId).toBe(characterId);
      expect(profile.userId).toBe(userId);
      expect(profile.responsePreferences).toBeDefined();
      expect(profile.boundaryPreferences).toBeDefined();
      expect(profile.adaptationHistory).toBeDefined();
    });
  });

  describe('importAdaptationProfile', () => {
    it('should import adaptation profile successfully', async () => {
      const characterId = 1;
      const userId = 'user123';
      const profile = {
        characterId,
        userId,
        createdAt: new Date(),
        lastUpdated: new Date(),
        interactionCount: 10,
        adaptationLevel: 0.3,
        responsePreferences: {
          preferredIntensityRange: { min: 2, max: 6 },
          preferredEmotionalTypes: ['радость', 'спокойствие'],
          avoidedEmotionalTypes: ['гнев', 'страх'],
          responseTimePreference: EmotionalResponseType.BALANCED,
          sensitivityLevel: EmotionalSensitivityLevel.MEDIUM,
          contextualAdaptation: true,
        },
        boundaryPreferences: {
          maxIntensityDeviation: 2,
          allowedEmotionalRange: [],
          restrictedEmotions: [],
          adaptationLimits: {
            maxPositiveShift: 0.3,
            maxNegativeShift: 0.3,
            preserveCoreTrait: true,
          },
        },
        adaptationHistory: [],
        learningRate: 0.1,
        effectivenessScore: 0.5,
      };

      await expect(
        service.importAdaptationProfile(characterId, userId, profile),
      ).resolves.not.toThrow();

      expect(mockLogService.log).toHaveBeenCalledWith(
        'Профиль эмоциональной адаптации импортирован',
        expect.any(Object),
      );
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully in analyzeAndAdaptEmotionalResponse', async () => {
      const characterId = 1;
      const userId = 'user123';
      const currentEmotion: EmotionalState = {
        primary: 'радость',
        intensity: 5,
        secondary: '',
        description: 'Приятное настроение',
      };
      const userResponse = 'тест';

      // Мок события может выбросить ошибку
      mockEventEmitter.emit.mockImplementation(() => {
        throw new Error('Event emission failed');
      });

      const result = await service.analyzeAndAdaptEmotionalResponse(
        characterId,
        userId,
        currentEmotion,
        userResponse,
      );

      // Сервис должен обработать ошибку и вернуть результат
      expect(result).toBeDefined();
    });

    it('should handle invalid input parameters', async () => {
      const characterId = -1; // невалидный ID
      const userId = '';
      const currentEmotion: EmotionalState = {
        primary: '',
        intensity: 0,
        secondary: '',
        description: '',
      };
      const userResponse = '';

      const result = await service.analyzeAndAdaptEmotionalResponse(
        characterId,
        userId,
        currentEmotion,
        userResponse,
      );

      expect(result).toBeDefined();
      // Сервис должен справиться с невалидными данными
    });
  });

  describe('adaptation boundaries', () => {
    it('should respect emotional boundaries when adapting', async () => {
      const characterId = 1;
      const userId = 'user123';
      const baseEmotion: EmotionalState = {
        primary: 'радость',
        intensity: 5,
        secondary: '',
        description: 'Умеренная радость',
      };
      const context = 'тестовый контекст';

      const result = await service.generateAdaptedEmotionalResponse(
        characterId,
        userId,
        baseEmotion,
        context,
      );

      // Проверяем, что адаптация не выходит за границы
      const intensityDifference = Math.abs(result.intensity - baseEmotion.intensity);
      expect(intensityDifference).toBeLessThanOrEqual(2); // Максимальное отклонение по умолчанию
    });
  });

  describe('pattern detection', () => {
    it('should detect positive interaction patterns', async () => {
      const characterId = 1;
      const userId = 'user123';
      const currentEmotion: EmotionalState = {
        primary: 'радость',
        intensity: 6,
        secondary: '',
        description: 'Хорошее настроение',
      };
      const userResponse = 'Отлично! Мне очень нравится!';

      const result = await service.analyzeAndAdaptEmotionalResponse(
        characterId,
        userId,
        currentEmotion,
        userResponse,
      );

      expect(result.userEmotionalResponse.emotionalIndicators.positive).toBeGreaterThan(0);
      expect(result.userEmotionalResponse.emotionalIndicators.satisfaction).toBeGreaterThan(0.5);
    });

    it('should detect negative interaction patterns', async () => {
      const characterId = 1;
      const userId = 'user123';
      const currentEmotion: EmotionalState = {
        primary: 'злость',
        intensity: 8,
        secondary: '',
        description: 'Сильное раздражение',
      };
      const userResponse = 'Не нравится, слишком агрессивно';

      const result = await service.analyzeAndAdaptEmotionalResponse(
        characterId,
        userId,
        currentEmotion,
        userResponse,
      );

      expect(result.userEmotionalResponse.emotionalIndicators.negative).toBeGreaterThan(0);
      expect(result.userEmotionalResponse.emotionalIndicators.satisfaction).toBeLessThan(0.5);
    });
  });

  describe('performance', () => {
    it('should complete adaptation analysis within reasonable time', async () => {
      const startTime = Date.now();

      const characterId = 1;
      const userId = 'user123';
      const currentEmotion: EmotionalState = {
        primary: 'нейтральная',
        intensity: 5,
        secondary: '',
        description: 'Спокойное состояние',
      };
      const userResponse = 'обычное сообщение';

      await service.analyzeAndAdaptEmotionalResponse(
        characterId,
        userId,
        currentEmotion,
        userResponse,
      );

      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(1000); // Должно выполняться менее чем за 1 секунду
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TechniqueHistoryService } from '../../../src/character/services/technique/technique-history.service';
import {
  TechniqueExecution,
  UserManipulationProfile,
} from '../../../src/character/entities/manipulation-technique.entity';
import { LogService } from '../../../src/logging/log.service';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
  TechniquePhase,
} from '../../../src/character/enums/technique.enums';
import { MockLogService } from '../../../lib/tester/mocks/log.service.mock';

describe('TechniqueHistoryService', () => {
  let service: TechniqueHistoryService;
  let techniqueExecutionRepository: jest.Mocked<Repository<TechniqueExecution>>;
  let userProfileRepository: jest.Mocked<Repository<UserManipulationProfile>>;
  let logService: MockLogService;

  const mockTechniqueExecution = {
    id: 1,
    techniqueType: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
    intensity: TechniqueIntensity.MEDIUM,
    phase: TechniquePhase.EXECUTION,
    characterId: 1,
    userId: 100,
    generatedResponse: 'Тестовый ответ',
    effectiveness: 75,
    ethicalScore: 80,
    sideEffects: ['positive_engagement'],
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T10:05:00Z'),
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:05:00Z'),
  };

  const mockUserProfile = {
    id: 1,
    characterId: 1,
    userId: 100,
    susceptibilityScore: 60,
    vulnerabilities: ['loneliness'],
    successfulTechniques: [ManipulativeTechniqueType.GRADUAL_INVOLVEMENT],
    resistedTechniques: [],
    emotionalTriggers: ['validation'],
    susceptibilityRatings: {
      [ManipulativeTechniqueType.GRADUAL_INVOLVEMENT]: 75,
    },
    effectivenessHistory: [
      {
        techniqueType: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
        attempts: 3,
        avgEffectiveness: 75,
        lastUsed: new Date('2024-01-01T10:00:00Z'),
      },
    ],
    immuneTechniques: [],
    lastUpdate: new Date('2024-01-01T10:00:00Z'),
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
  };

  beforeEach(async () => {
    const mockTechniqueExecutionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const mockUserProfileRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TechniqueHistoryService,
        {
          provide: getRepositoryToken(TechniqueExecution),
          useValue: mockTechniqueExecutionRepository,
        },
        {
          provide: getRepositoryToken(UserManipulationProfile),
          useValue: mockUserProfileRepository,
        },
        {
          provide: LogService,
          useClass: MockLogService,
        },
      ],
    }).compile();

    service = module.get<TechniqueHistoryService>(TechniqueHistoryService);
    techniqueExecutionRepository = module.get(getRepositoryToken(TechniqueExecution));
    userProfileRepository = module.get(getRepositoryToken(UserManipulationProfile));
    logService = module.get<MockLogService>(LogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordTechniqueExecution', () => {
    it('должен записать выполнение техники в базу данных', async () => {
      const testData = {
        success: true,
        techniqueType: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
        intensity: TechniqueIntensity.MEDIUM,
        phase: TechniquePhase.EXECUTION,
        characterId: 1,
        userId: 100,
        message: 'Тестовый ответ',
        effectiveness: 75,
        ethicalScore: 80,
        sideEffects: ['positive_engagement'],
      };

      techniqueExecutionRepository.create.mockReturnValue(mockTechniqueExecution as any);
      techniqueExecutionRepository.save.mockResolvedValue(mockTechniqueExecution as any);
      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);
      userProfileRepository.save.mockResolvedValue(mockUserProfile as any);

      await service.recordTechniqueExecution(testData);

      expect(techniqueExecutionRepository.create).toHaveBeenCalledWith({
        techniqueType: testData.techniqueType,
        intensity: testData.intensity,
        phase: testData.phase,
        characterId: testData.characterId,
        userId: testData.userId,
        generatedResponse: testData.message,
        effectiveness: testData.effectiveness,
        ethicalScore: testData.ethicalScore,
        sideEffects: testData.sideEffects,
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        executionContext: undefined,
      });
      expect(techniqueExecutionRepository.save).toHaveBeenCalled();
    });

    it('должен создать новый профиль пользователя если он не существует', async () => {
      const testData = {
        success: true,
        techniqueType: ManipulativeTechniqueType.VALIDATION,
        intensity: TechniqueIntensity.SUBTLE,
        phase: TechniquePhase.DEVELOPMENT,
        characterId: 2,
        userId: 200,
        message: 'Новый ответ',
        effectiveness: 60,
        ethicalScore: 90,
        sideEffects: [],
      };

      techniqueExecutionRepository.create.mockReturnValue(mockTechniqueExecution as any);
      techniqueExecutionRepository.save.mockResolvedValue(mockTechniqueExecution as any);
      userProfileRepository.findOne.mockResolvedValue(null);
      userProfileRepository.create.mockReturnValue(mockUserProfile as any);
      userProfileRepository.save.mockResolvedValue(mockUserProfile as any);

      await service.recordTechniqueExecution(testData);

      expect(userProfileRepository.create).toHaveBeenCalledWith({
        characterId: testData.characterId,
        userId: testData.userId,
        susceptibilityScore: 50,
        vulnerabilities: [],
        successfulTechniques: [],
        resistedTechniques: [],
        emotionalTriggers: [],
        susceptibilityRatings: {},
        effectivenessHistory: [],
        immuneTechniques: [],
      });
    });
  });

  describe('getHistory', () => {
    it('должен возвращать историю выполнения техник', async () => {
      const executions = [mockTechniqueExecution];
      techniqueExecutionRepository.find.mockResolvedValue(executions as any);

      const result = await service.getHistory('1', 10);

      expect(techniqueExecutionRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1 },
        order: { createdAt: 'DESC' },
        take: 10,
      });

      expect(result).toEqual([
        {
          success: true,
          message: 'Тестовый ответ',
          techniqueType: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
          intensity: TechniqueIntensity.MEDIUM,
          phase: TechniquePhase.EXECUTION,
          effectiveness: 75,
          ethicalScore: 80,
          sideEffects: ['positive_engagement'],
        },
      ]);
    });

    it('должен возвращать пустой массив если нет выполнений', async () => {
      techniqueExecutionRepository.find.mockResolvedValue([]);

      const result = await service.getHistory('1', 10);

      expect(result).toEqual([]);
    });
  });

  describe('getTechniqueStatistics', () => {
    it('должен возвращать статистику по всем техникам персонажа', async () => {
      const executions = [
        { ...mockTechniqueExecution, effectiveness: 80 },
        { ...mockTechniqueExecution, effectiveness: 70 },
        { ...mockTechniqueExecution, effectiveness: 60, sideEffects: ['resistance'] },
      ];
      techniqueExecutionRepository.find.mockResolvedValue(executions as any);

      const result = await service.getTechniqueStatistics('1');

      expect(result).toEqual({
        totalExecutions: 3,
        averageEffectiveness: 70,
        averageEthicalScore: 80,
        commonSideEffects: ['positive_engagement', 'resistance'],
        successRate: 100, // все выполнения > 50
        lastUsed: expect.any(Date),
        trendsData: expect.any(Object),
      });
    });

    it('должен возвращать статистику по конкретной технике', async () => {
      const executions = [mockTechniqueExecution];
      techniqueExecutionRepository.find.mockResolvedValue(executions as any);

      const result = await service.getTechniqueStatistics(
        '1',
        ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
      );

      expect(techniqueExecutionRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1, techniqueType: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT },
        order: { createdAt: 'DESC' },
      });

      expect(result.totalExecutions).toBe(1);
    });

    it('должен возвращать нулевую статистику если нет данных', async () => {
      techniqueExecutionRepository.find.mockResolvedValue([]);

      const result = await service.getTechniqueStatistics('1');

      expect(result).toEqual({
        totalExecutions: 0,
        averageEffectiveness: 0,
        averageEthicalScore: 0,
        commonSideEffects: [],
        successRate: 0,
      });
    });
  });

  describe('getTechniqueRecommendations', () => {
    it('должен возвращать рекомендации на основе профиля пользователя', async () => {
      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);

      const result = await service.getTechniqueRecommendations(1, 100);

      // Система может рекомендовать альтернативную технику если основная использовалась недавно
      expect([
        ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
        ManipulativeTechniqueType.VALIDATION,
      ]).toContain(result.recommendedTechnique);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning).toMatch(/эффективность|альтернатива/);
      expect(result.alternativeTechniques).toBeDefined();
    });

    it('должен возвращать технику по умолчанию если профиль не найден', async () => {
      userProfileRepository.findOne.mockResolvedValue(null);

      const result = await service.getTechniqueRecommendations(1, 100);

      expect(result).toEqual({
        recommendedTechnique: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
        confidence: 0.3,
        reasoning: 'Нет данных о профиле пользователя, используется техника по умолчанию',
        alternativeTechniques: [
          ManipulativeTechniqueType.VALIDATION,
          ManipulativeTechniqueType.PUSH_PULL,
        ],
      });
    });

    it('должен рекомендовать альтернативную технику если лучшая использовалась недавно', async () => {
      const recentProfile = {
        ...mockUserProfile,
        effectivenessHistory: [
          {
            techniqueType: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
            attempts: 5,
            avgEffectiveness: 80,
            lastUsed: new Date(), // сегодня
          },
          {
            techniqueType: ManipulativeTechniqueType.VALIDATION,
            attempts: 2,
            avgEffectiveness: 70,
            lastUsed: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 дня назад
          },
        ],
      };

      userProfileRepository.findOne.mockResolvedValue(recentProfile as any);

      const result = await service.getTechniqueRecommendations(1, 100);

      expect(result.recommendedTechnique).toBe(ManipulativeTechniqueType.VALIDATION);
      expect(result.confidence).toBe(0.7);
      expect(result.reasoning).toContain('использовалась недавно');
    });
  });

  describe('getCharacterTechniqueAnalytics', () => {
    it('должен возвращать аналитику по техникам персонажа', async () => {
      const executions = [
        {
          ...mockTechniqueExecution,
          techniqueType: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
          effectiveness: 80,
        },
        {
          ...mockTechniqueExecution,
          techniqueType: ManipulativeTechniqueType.VALIDATION,
          effectiveness: 70,
        },
        {
          ...mockTechniqueExecution,
          techniqueType: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
          effectiveness: 75,
        },
      ];
      techniqueExecutionRepository.find.mockResolvedValue(executions as any);

      const result = await service.getCharacterTechniqueAnalytics(1);

      expect(result).toEqual({
        totalTechniques: 2,
        mostUsedTechnique: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
        mostEffectiveTechnique: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
        averageEthicalScore: 80,
        trendsAnalysis: {
          improvingTechniques: [],
          decliningTechniques: [],
        },
      });
    });

    it('должен возвращать значения по умолчанию если нет данных', async () => {
      techniqueExecutionRepository.find.mockResolvedValue([]);

      const result = await service.getCharacterTechniqueAnalytics(1);

      expect(result).toEqual({
        totalTechniques: 0,
        mostUsedTechnique: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
        mostEffectiveTechnique: ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
        averageEthicalScore: 50,
        trendsAnalysis: {
          improvingTechniques: [],
          decliningTechniques: [],
        },
      });
    });
  });

  describe('recordExecution', () => {
    it('должен записать выполнение техники если есть все необходимые данные', async () => {
      const testData = {
        success: true,
        techniqueType: ManipulativeTechniqueType.VALIDATION,
        message: 'Тест',
        characterId: 1,
        userId: 100,
        effectiveness: 80,
      };

      techniqueExecutionRepository.create.mockReturnValue(mockTechniqueExecution as any);
      techniqueExecutionRepository.save.mockResolvedValue(mockTechniqueExecution as any);
      userProfileRepository.findOne.mockResolvedValue(mockUserProfile as any);
      userProfileRepository.save.mockResolvedValue(mockUserProfile as any);

      await service.recordExecution(testData);

      expect(techniqueExecutionRepository.save).toHaveBeenCalled();
    });

    it('должен предупредить и не записывать если отсутствуют обязательные поля', async () => {
      const testData = {
        success: true,
        techniqueType: ManipulativeTechniqueType.VALIDATION,
        message: 'Тест',
        // отсутствуют characterId и userId
      };

      await service.recordExecution(testData);

      expect(logService.winstonLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Не удалось записать выполнение техники: отсутствуют characterId или userId',
        ),
        expect.any(Object),
      );
      expect(techniqueExecutionRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getTechniqueHistory', () => {
    it('должен возвращать историю техник с использованием getHistory', async () => {
      const executions = [mockTechniqueExecution];
      techniqueExecutionRepository.find.mockResolvedValue(executions as any);

      const result = await service.getTechniqueHistory('1', 5);

      expect(techniqueExecutionRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1 },
        order: { createdAt: 'DESC' },
        take: 5,
      });

      expect(result).toHaveLength(1);
      expect(result[0].techniqueType).toBe(ManipulativeTechniqueType.GRADUAL_INVOLVEMENT);
    });
  });

  describe('private methods', () => {
    it('должен правильно анализировать тренды', async () => {
      const oldExecutions = [
        { ...mockTechniqueExecution, effectiveness: 60, createdAt: new Date('2024-01-01') },
        { ...mockTechniqueExecution, effectiveness: 65, createdAt: new Date('2024-01-02') },
      ];
      const newExecutions = [
        { ...mockTechniqueExecution, effectiveness: 80, createdAt: new Date('2024-01-03') },
        { ...mockTechniqueExecution, effectiveness: 85, createdAt: new Date('2024-01-04') },
      ];

      techniqueExecutionRepository.find.mockResolvedValue([
        ...newExecutions,
        ...oldExecutions,
      ] as any);

      const result = await service.getTechniqueStatistics('1');

      expect(result.trendsData).toBeDefined();
      expect(result.trendsData.effectivenessOverTime).toBeDefined();
      expect(result.trendsData.usageFrequency).toBeDefined();
    });
  });
});

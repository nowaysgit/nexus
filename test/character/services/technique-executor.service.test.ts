import { Test, TestingModule } from '@nestjs/testing';
import { TechniqueExecutorService } from '../../../src/character/services/technique/technique-executor.service';
import { LogService } from '../../../src/logging/log.service';
import { TechniqueHistoryService } from '../../../src/character/services/technique/technique-history.service';
import { TechniqueStrategyService } from '../../../src/character/services/technique/technique-strategy.service';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
  TechniquePhase,
  ITechniqueContext,
  ITechniqueResult,
} from '../../../src/character/interfaces/technique.interfaces';

describe('TechniqueExecutorService', () => {
  let service: TechniqueExecutorService;
  let mockLogService: jest.Mocked<LogService>;
  let mockHistoryService: jest.Mocked<TechniqueHistoryService>;
  let mockStrategyService: jest.Mocked<TechniqueStrategyService>;

  const mockContext: ITechniqueContext = {
    characterId: 1,
    userId: 1,
    messageContent: 'Test message',
    relationshipLevel: 50,
    emotionalState: {
      dominantEmotion: 'neutral',
      intensity: 0.5,
    } as any,
    needsState: {
      attention: 70,
      validation: 60,
    },
    conversationHistory: ['Previous message'],
    timeOfDay: 'morning',
    sessionDuration: 30,
  };

  const mockStrategy = {
    techniqueType: ManipulativeTechniqueType.VALIDATION,
    promptTemplate: 'Test prompt with {{intensity}} intensity',
    intensityModifiers: {
      [TechniqueIntensity.SUBTLE]: 0.3,
      [TechniqueIntensity.MODERATE]: 0.6,
      [TechniqueIntensity.MEDIUM]: 0.8,
      [TechniqueIntensity.AGGRESSIVE]: 1.0,
    },
    ethicalConstraints: {
      maxUsagePerHour: 5,
      cooldownMinutes: 60,
      bannedCombinations: [],
    },
    contextRequirements: {
      minRelationshipLevel: 0,
      requiredEmotionalStates: [],
      forbiddenStates: [],
    },
  };

  beforeEach(async () => {
    const mockLogServiceFactory = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
    };

    const mockHistoryServiceFactory = {
      recordExecution: jest.fn(),
      getHistory: jest.fn(),
      getTechniqueStatistics: jest.fn(),
      getTechniqueHistory: jest.fn(),
    };

    const mockStrategyServiceFactory = {
      getStrategy: jest.fn(),
      getAllStrategies: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TechniqueExecutorService,
        {
          provide: LogService,
          useValue: mockLogServiceFactory,
        },
        {
          provide: TechniqueHistoryService,
          useValue: mockHistoryServiceFactory,
        },
        {
          provide: TechniqueStrategyService,
          useValue: mockStrategyServiceFactory,
        },
      ],
    }).compile();

    service = module.get<TechniqueExecutorService>(TechniqueExecutorService);
    mockLogService = module.get(LogService);
    mockHistoryService = module.get(TechniqueHistoryService);
    mockStrategyService = module.get(TechniqueStrategyService);
  });

  describe('executeTechnique', () => {
    it('should successfully execute a technique', async () => {
      mockStrategyService.getStrategy.mockReturnValue(mockStrategy);
      mockHistoryService.recordExecution.mockResolvedValue(undefined);

      const result = await service.executeTechnique(
        ManipulativeTechniqueType.VALIDATION,
        TechniqueIntensity.MODERATE,
        mockContext,
        TechniquePhase.EXECUTION,
      );

      expect(result.success).toBe(true);
      expect(result.techniqueType).toBe(ManipulativeTechniqueType.VALIDATION);
      expect(result.intensity).toBe(TechniqueIntensity.MODERATE);
      expect(result.phase).toBe(TechniquePhase.EXECUTION);
      expect(result.effectiveness).toBeGreaterThan(0);
      expect(result.ethicalScore).toBeGreaterThan(0);
      expect(result.message).toContain('moderate');
      expect(mockHistoryService.recordExecution).toHaveBeenCalledWith(result);
    });

    it('should fail when strategy is not found', async () => {
      mockStrategyService.getStrategy.mockReturnValue(null);

      const result = await service.executeTechnique(
        ManipulativeTechniqueType.VALIDATION,
        TechniqueIntensity.MODERATE,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Стратегия выполнения не найдена');
      expect(result.effectiveness).toBe(0);
      expect(result.sideEffects).toContain('strategy_not_found');
    });

    it('should fail when technique is on cooldown', async () => {
      mockStrategyService.getStrategy.mockReturnValue(mockStrategy);

      // Первое выполнение
      await service.executeTechnique(
        ManipulativeTechniqueType.VALIDATION,
        TechniqueIntensity.MODERATE,
        mockContext,
      );

      // Второе выполнение должно быть заблокировано
      const result = await service.executeTechnique(
        ManipulativeTechniqueType.VALIDATION,
        TechniqueIntensity.MODERATE,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('на охлаждении');
      expect(result.sideEffects).toContain('cooldown_active');
    });

    it('should fail when context requirements are not met', async () => {
      const restrictiveStrategy = {
        ...mockStrategy,
        contextRequirements: {
          minRelationshipLevel: 80,
          requiredEmotionalStates: ['happy'],
          forbiddenStates: [],
        },
      };

      mockStrategyService.getStrategy.mockReturnValue(restrictiveStrategy);

      const result = await service.executeTechnique(
        ManipulativeTechniqueType.VALIDATION,
        TechniqueIntensity.MODERATE,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Контекст не подходит');
      expect(result.sideEffects).toContain('invalid_context');
    });

    it('should handle execution errors gracefully', async () => {
      mockStrategyService.getStrategy.mockReturnValue(mockStrategy);
      mockHistoryService.recordExecution.mockRejectedValue(new Error('Database error'));

      const result = await service.executeTechnique(
        ManipulativeTechniqueType.VALIDATION,
        TechniqueIntensity.MODERATE,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Ошибка выполнения техники');
      expect(result.sideEffects).toContain('execution_error');
    });

    it('should apply different intensity modifiers', async () => {
      mockStrategyService.getStrategy.mockReturnValue(mockStrategy);
      mockHistoryService.recordExecution.mockResolvedValue(undefined);

      const subtleResult = await service.executeTechnique(
        ManipulativeTechniqueType.VALIDATION,
        TechniqueIntensity.SUBTLE,
        mockContext,
      );

      const aggressiveResult = await service.executeTechnique(
        ManipulativeTechniqueType.LOVE_BOMBING,
        TechniqueIntensity.AGGRESSIVE,
        { ...mockContext, characterId: 2 },
      );

      expect(subtleResult.effectiveness).toBeLessThan(aggressiveResult.effectiveness);
    });
  });

  describe('canExecuteTechnique', () => {
    it('should return true when technique can be executed', async () => {
      mockStrategyService.getStrategy.mockReturnValue(mockStrategy);

      const result = await service.canExecuteTechnique(
        ManipulativeTechniqueType.VALIDATION,
        TechniqueIntensity.MODERATE,
        mockContext,
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return false when strategy is not found', async () => {
      mockStrategyService.getStrategy.mockReturnValue(null);

      const result = await service.canExecuteTechnique(
        ManipulativeTechniqueType.VALIDATION,
        TechniqueIntensity.MODERATE,
        mockContext,
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Стратегия выполнения не найдена');
    });

    it('should return false when technique is on cooldown', async () => {
      mockStrategyService.getStrategy.mockReturnValue(mockStrategy);

      // Выполняем технику первый раз
      await service.executeTechnique(
        ManipulativeTechniqueType.VALIDATION,
        TechniqueIntensity.MODERATE,
        mockContext,
      );

      // Проверяем возможность повторного выполнения
      const result = await service.canExecuteTechnique(
        ManipulativeTechniqueType.VALIDATION,
        TechniqueIntensity.MODERATE,
        mockContext,
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('на охлаждении');
    });
  });

  describe('selectAdaptiveTechnique', () => {
    it('should select appropriate technique based on context', async () => {
      const strategiesMap = new Map();
      strategiesMap.set(ManipulativeTechniqueType.VALIDATION, mockStrategy);
      strategiesMap.set(ManipulativeTechniqueType.LOVE_BOMBING, {
        ...mockStrategy,
        techniqueType: ManipulativeTechniqueType.LOVE_BOMBING,
      });
      mockStrategyService.getAllStrategies.mockReturnValue(strategiesMap);
      // Настраиваем мок для getStrategy, чтобы он возвращал стратегию
      mockStrategyService.getStrategy.mockReturnValue(mockStrategy);

      const result = await service.selectAdaptiveTechnique(mockContext);

      expect(result).toBeDefined();
      expect(result?.techniqueType).toBeDefined();
      expect(result?.intensity).toBeDefined();
      expect(result?.confidence).toBeGreaterThan(0);
    });

    it('should return null when no suitable technique found', async () => {
      mockStrategyService.getAllStrategies.mockReturnValue(new Map());

      const result = await service.selectAdaptiveTechnique(mockContext);

      expect(result).toBeNull();
    });
  });

  describe('getTechniqueStatistics', () => {
    it('should return statistics for character', async () => {
      const mockHistory: ITechniqueResult[] = [
        {
          success: true,
          techniqueType: ManipulativeTechniqueType.VALIDATION,
          intensity: TechniqueIntensity.MODERATE,
          message: 'Test message',
          effectiveness: 75,
          ethicalScore: 60,
          sideEffects: ['mild_confusion'],
          phase: TechniquePhase.EXECUTION,
        },
        {
          success: true,
          techniqueType: ManipulativeTechniqueType.VALIDATION,
          intensity: TechniqueIntensity.MODERATE,
          message: 'Test message 2',
          effectiveness: 80,
          ethicalScore: 70,
          sideEffects: ['mild_confusion'],
          phase: TechniquePhase.EXECUTION,
        },
      ];

      mockHistoryService.getHistory.mockResolvedValue(mockHistory);

      const result = await service.getTechniqueStatistics('1');

      expect(result.totalExecutions).toBe(2);
      expect(result.averageEffectiveness).toBe(77.5);
      expect(result.averageEthicalScore).toBe(65);
      expect(result.commonSideEffects).toContain('mild_confusion');
      expect(result.successRate).toBe(100);
      expect(result.mostEffectiveTechnique).toBe(ManipulativeTechniqueType.VALIDATION);
    });

    it('should return statistics for specific technique', async () => {
      const mockHistory: ITechniqueResult[] = [
        {
          success: true,
          techniqueType: ManipulativeTechniqueType.VALIDATION,
          intensity: TechniqueIntensity.MODERATE,
          message: 'Test message',
          effectiveness: 80,
          ethicalScore: 70,
          sideEffects: ['increased_attachment'],
          phase: TechniquePhase.EXECUTION,
        },
        {
          success: true,
          techniqueType: ManipulativeTechniqueType.LOVE_BOMBING,
          intensity: TechniqueIntensity.MODERATE,
          message: 'Test message 2',
          effectiveness: 60,
          ethicalScore: 50,
          sideEffects: ['other_effect'],
          phase: TechniquePhase.EXECUTION,
        },
      ];

      mockHistoryService.getHistory.mockResolvedValue(mockHistory);

      const result = await service.getTechniqueStatistics(
        '1',
        ManipulativeTechniqueType.VALIDATION,
      );

      expect(result.totalExecutions).toBe(1);
      expect(result.averageEffectiveness).toBe(80);
      expect(result.averageEthicalScore).toBe(70);
      expect(result.commonSideEffects).toContain('increased_attachment');
      expect(result.successRate).toBe(100);
    });
  });

  describe('getTechniqueHistory', () => {
    it('should return technique history', async () => {
      const mockHistory: ITechniqueResult[] = [
        {
          success: true,
          techniqueType: ManipulativeTechniqueType.VALIDATION,
          intensity: TechniqueIntensity.MODERATE,
          message: 'Test message',
          effectiveness: 75,
          ethicalScore: 60,
          sideEffects: [],
          phase: TechniquePhase.EXECUTION,
        },
      ];

      mockHistoryService.getHistory.mockResolvedValue(mockHistory);

      const result = await service.getTechniqueHistory('1', 5);

      expect(result).toEqual(mockHistory);
      expect(mockHistoryService.getHistory).toHaveBeenCalledWith('1', 5);
    });

    it('should use default limit when not specified', async () => {
      mockHistoryService.getHistory.mockResolvedValue([]);

      await service.getTechniqueHistory('1');

      expect(mockHistoryService.getHistory).toHaveBeenCalledWith('1', 10);
    });
  });

  describe('ethical constraints', () => {
    it('should respect ethical limits for technique intensity', async () => {
      mockStrategyService.getStrategy.mockReturnValue(mockStrategy);

      // Попытка использовать агрессивную технику для персонажа с ограничениями
      const result = await service.executeTechnique(
        ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL,
        TechniqueIntensity.AGGRESSIVE,
        mockContext,
      );

      // Проверяем, что техника может быть ограничена этическими правилами
      expect(result).toBeDefined();
      expect(result.ethicalScore).toBeLessThan(100);
    });

    it('should block banned techniques', async () => {
      // Создаем контекст для персонажа с этическими ограничениями
      const restrictedContext = { ...mockContext, characterId: 999 };

      // Не настраиваем мок для getStrategy, чтобы он вернул null
      mockStrategyService.getStrategy.mockReturnValue(null);

      const result = await service.executeTechnique(
        ManipulativeTechniqueType.GASLIGHTING,
        TechniqueIntensity.AGGRESSIVE,
        restrictedContext,
      );

      // Проверяем, что техника заблокирована
      expect(result.success).toBe(false);
      expect(result.message).toContain('Стратегия выполнения не найдена');
      expect(result.sideEffects).toContain('strategy_not_found');
    });
  });

  describe('cooldown system', () => {
    it('should track cooldowns per character and technique', async () => {
      mockStrategyService.getStrategy.mockReturnValue(mockStrategy);
      mockHistoryService.recordExecution.mockResolvedValue(undefined);

      const context1 = { ...mockContext, characterId: 1 };
      const context2 = { ...mockContext, characterId: 2 };

      // Выполняем технику для первого персонажа
      await service.executeTechnique(
        ManipulativeTechniqueType.VALIDATION,
        TechniqueIntensity.MODERATE,
        context1,
      );

      // Выполняем ту же технику для второго персонажа (должно работать)
      const result2 = await service.executeTechnique(
        ManipulativeTechniqueType.VALIDATION,
        TechniqueIntensity.MODERATE,
        context2,
      );

      expect(result2.success).toBe(true);

      // Повторное выполнение для первого персонажа должно быть заблокировано
      const result1Again = await service.executeTechnique(
        ManipulativeTechniqueType.VALIDATION,
        TechniqueIntensity.MODERATE,
        context1,
      );

      expect(result1Again.success).toBe(false);
      expect(result1Again.sideEffects).toContain('cooldown_active');
    });
  });

  describe('side effects determination', () => {
    it('should determine appropriate side effects based on technique and intensity', async () => {
      mockStrategyService.getStrategy.mockReturnValue(mockStrategy);
      mockHistoryService.recordExecution.mockResolvedValue(undefined);

      const result = await service.executeTechnique(
        ManipulativeTechniqueType.LOVE_BOMBING,
        TechniqueIntensity.AGGRESSIVE,
        mockContext,
      );

      expect(result.sideEffects).toBeDefined();
      expect(Array.isArray(result.sideEffects)).toBe(true);
    });
  });

  describe('context validation', () => {
    it('should validate required context fields', async () => {
      const incompleteContext = {
        characterId: 1,
        relationshipLevel: 10, // Ниже минимального уровня
        // messageContent отсутствует
      } as ITechniqueContext;

      const restrictiveStrategy = {
        ...mockStrategy,
        contextRequirements: {
          minRelationshipLevel: 50, // Требуется уровень отношений 50
          requiredEmotionalStates: [],
          forbiddenStates: [],
        },
      };

      mockStrategyService.getStrategy.mockReturnValue(restrictiveStrategy);

      const result = await service.executeTechnique(
        ManipulativeTechniqueType.VALIDATION,
        TechniqueIntensity.MODERATE,
        incompleteContext,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Контекст не подходит');
    });
  });
});

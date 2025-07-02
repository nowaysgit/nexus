import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { TechniqueExecutorService } from '../../src/character/services/technique-executor.service';
import { TechniqueStrategyService } from '../../src/character/services/technique-strategy.service';
import { TechniqueValidatorService } from '../../src/character/services/technique-validator.service';
import { TechniqueAnalyzerService } from '../../src/character/services/technique-analyzer.service';
import { TechniqueGeneratorService } from '../../src/character/services/technique-generator.service';
import { TechniqueAdapterService } from '../../src/character/services/technique-adapter.service';
import { TechniqueHistoryService } from '../../src/character/services/technique-history.service';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
  TechniquePhase,
} from '../../src/character/enums/technique.enums';
import {
  ITechniqueContext,
  ITechniqueResult,
} from '../../src/character/interfaces/technique.interfaces';
import { ITechniqueExecutionStrategy } from '../../src/character/services/technique-strategy.service';

describe('TechniqueExecutorService Unit Tests', () => {
  let moduleRef: import('@nestjs/testing').TestingModule | null = null;
  let service: TechniqueExecutorService;
  let mockStrategyService: jest.Mocked<TechniqueStrategyService>;
  let mockValidatorService: jest.Mocked<TechniqueValidatorService>;
  let mockAnalyzerService: jest.Mocked<TechniqueAnalyzerService>;
  let mockGeneratorService: jest.Mocked<TechniqueGeneratorService>;
  let mockAdapterService: jest.Mocked<TechniqueAdapterService>;
  let mockHistoryService: jest.Mocked<TechniqueHistoryService>;

  beforeEach(async () => {
    // Создаем моки сервисов
    mockStrategyService = {
      getStrategy: jest.fn(),
      getAllStrategies: jest.fn().mockReturnValue(new Map()),
    } as any;

    mockValidatorService = {
      validateTechniqueExecution: jest.fn(),
    } as any;

    mockAnalyzerService = {
      analyzeTechniqueResult: jest.fn(),
    } as any;

    mockGeneratorService = {
      generateTechnique: jest.fn(),
    } as any;

    mockAdapterService = {
      adaptTechniqueToContext: jest.fn(),
    } as any;

    mockHistoryService = {
      recordExecution: jest.fn(),
      getHistory: jest.fn().mockResolvedValue([]),
    } as any;

    moduleRef = await TestModuleBuilder.create()
      .withProviders([
        TechniqueExecutorService,
        {
          provide: TechniqueStrategyService,
          useValue: mockStrategyService,
        },
        {
          provide: TechniqueValidatorService,
          useValue: mockValidatorService,
        },
        {
          provide: TechniqueAnalyzerService,
          useValue: mockAnalyzerService,
        },
        {
          provide: TechniqueGeneratorService,
          useValue: mockGeneratorService,
        },
        {
          provide: TechniqueAdapterService,
          useValue: mockAdapterService,
        },
        {
          provide: TechniqueHistoryService,
          useValue: mockHistoryService,
        },
      ])
      .withRequiredMocks()
      .compile();

    service = moduleRef.get<TechniqueExecutorService>(TechniqueExecutorService);
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
      moduleRef = null;
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should execute technique successfully', async () => {
    // Настраиваем стратегию
    const mockStrategy = {
      techniqueType: ManipulativeTechniqueType.PUSH_PULL,
      promptTemplate: 'Test prompt {{intensity}}',
      intensityModifiers: {
        [TechniqueIntensity.SUBTLE]: 0.3,
        [TechniqueIntensity.MODERATE]: 0.6,
        [TechniqueIntensity.MEDIUM]: 0.8,
        [TechniqueIntensity.AGGRESSIVE]: 1.0,
      },
      ethicalConstraints: {
        maxUsagePerHour: 5,
        cooldownMinutes: 1,
        bannedCombinations: [],
      },
      contextRequirements: {
        minRelationshipLevel: 0,
        requiredEmotionalStates: [],
        forbiddenStates: [],
      },
    };

    mockStrategyService.getStrategy.mockReturnValue(mockStrategy);
    mockHistoryService.recordExecution.mockResolvedValue(undefined);

    const context: ITechniqueContext = {
      characterId: 1,
      userId: 1,
      messageContent: 'Test message',
      emotionalState: { primary: 'neutral', secondary: 'focused', current: 'neutral' },
      needsState: { COMMUNICATION: 50 },
      relationshipLevel: 25,
      previousInteractions: 5,
      conversationHistory: [],
    };

    const result = await service.executeTechnique(
      ManipulativeTechniqueType.PUSH_PULL,
      TechniqueIntensity.MODERATE,
      context,
      TechniquePhase.EXECUTION,
    );

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.techniqueType).toBe(ManipulativeTechniqueType.PUSH_PULL);
    expect(result.intensity).toBe(TechniqueIntensity.MODERATE);
    expect(result.effectiveness).toBeGreaterThan(0);
    expect(mockHistoryService.recordExecution).toHaveBeenCalledWith(result);
  });

  it('should reject technique when strategy not found', async () => {
    // Мокаем стратегию, которая не найдена
    mockStrategyService.getStrategy.mockReturnValue(null);

    const context: ITechniqueContext = {
      characterId: 999,
      userId: 1,
      messageContent: 'Test message',
      emotionalState: { primary: 'neutral', secondary: 'focused', current: 'neutral' },
      needsState: { COMMUNICATION: 50 },
      relationshipLevel: 25,
      previousInteractions: 5,
      conversationHistory: [],
    };

    const result = await service.executeTechnique(
      ManipulativeTechniqueType.GASLIGHTING,
      TechniqueIntensity.AGGRESSIVE,
      context,
    );

    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.message).toContain('Стратегия выполнения не найдена');
    expect(result.ethicalScore).toBe(50);
  });

  it('should select adaptive technique based on context', async () => {
    const mockStrategy: ITechniqueExecutionStrategy = {
      techniqueType: ManipulativeTechniqueType.VALIDATION,
      promptTemplate: 'Validation prompt',
      intensityModifiers: {
        [TechniqueIntensity.SUBTLE]: 0.2,
        [TechniqueIntensity.MODERATE]: 0.4,
        [TechniqueIntensity.MEDIUM]: 0.6,
        [TechniqueIntensity.AGGRESSIVE]: 0.8,
      },
      ethicalConstraints: {
        maxUsagePerHour: 5,
        cooldownMinutes: 5,
        bannedCombinations: [],
      },
      contextRequirements: {
        minRelationshipLevel: 5,
        requiredEmotionalStates: ['upset'],
        forbiddenStates: [],
      },
    };

    // Мокаем стратегии
    const strategiesMap = new Map<ManipulativeTechniqueType, ITechniqueExecutionStrategy>();
    strategiesMap.set(ManipulativeTechniqueType.VALIDATION, mockStrategy);

    mockStrategyService.getStrategy.mockReturnValue(mockStrategy);
    mockStrategyService.getAllStrategies.mockReturnValue(strategiesMap);

    const context: ITechniqueContext = {
      characterId: 1,
      userId: 1,
      messageContent: 'I feel upset',
      emotionalState: { primary: 'upset', secondary: 'confused', current: 'upset' },
      needsState: { VALIDATION: 80 },
      relationshipLevel: 15,
      previousInteractions: 3,
      conversationHistory: [],
    };

    const selectedTechnique = await service.selectAdaptiveTechnique(context);

    expect(selectedTechnique).toBeDefined();
    expect(selectedTechnique?.techniqueType).toBe(ManipulativeTechniqueType.VALIDATION);
    expect(selectedTechnique?.confidence).toBeGreaterThan(0);
  });

  it('should get technique statistics', async () => {
    const mockHistory: ITechniqueResult[] = [
      {
        success: true,
        techniqueType: ManipulativeTechniqueType.PUSH_PULL,
        intensity: TechniqueIntensity.MODERATE,
        message: 'Test message 1',
        effectiveness: 75,
        ethicalScore: 60,
        sideEffects: [],
        phase: TechniquePhase.EXECUTION,
      },
      {
        success: true,
        techniqueType: ManipulativeTechniqueType.VALIDATION,
        intensity: TechniqueIntensity.SUBTLE,
        message: 'Test message 2',
        effectiveness: 85,
        ethicalScore: 90,
        sideEffects: ['strong_influence'],
        phase: TechniquePhase.EXECUTION,
      },
    ];

    mockHistoryService.getHistory.mockResolvedValue(mockHistory);

    const stats = await service.getTechniqueStatistics('1');

    expect(stats).toBeDefined();
    expect(stats.totalExecutions).toBe(2);
    expect(stats.averageEffectiveness).toBe(80);
    expect(stats.averageEthicalScore).toBe(75);
    expect(stats.successRate).toBe(100);
    expect(stats.commonSideEffects).toContain('strong_influence');
    expect(stats.mostEffectiveTechnique).toBe(ManipulativeTechniqueType.VALIDATION);
  });
});

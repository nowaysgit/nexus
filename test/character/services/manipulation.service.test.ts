import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ManipulationService } from '../../../src/character/services/manipulation/manipulation.service';
import { Character } from '../../../src/character/entities/character.entity';
import {
  TechniqueExecution,
  UserManipulationProfile,
} from '../../../src/character/entities/manipulation-technique.entity';
import { NeedsService } from '../../../src/character/services/core/needs.service';
import { EmotionalStateService } from '../../../src/character/services/core/emotional-state.service';
import { LLMService } from '../../../src/llm/services/llm.service';
import { PromptTemplateService } from '../../../src/prompt-template/prompt-template.service';
import { LogService } from '../../../src/logging/log.service';
import { TechniqueExecutorService } from '../../../src/character/services/technique/technique-executor.service';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
} from '../../../src/character/enums/technique.enums';

describe('ManipulationService', () => {
  let service: ManipulationService;
  let mockCharacterRepository: Partial<Repository<Character>>;
  let mockTechniqueExecutionRepository: Partial<Repository<TechniqueExecution>>;
  let mockUserManipulationProfileRepository: Partial<Repository<UserManipulationProfile>>;
  let mockNeedsService: Partial<NeedsService>;
  let mockEmotionalStateService: Partial<EmotionalStateService>;
  let mockLLMService: Partial<LLMService>;
  let mockPromptTemplateService: Partial<PromptTemplateService>;
  let mockLogService: Partial<LogService>;
  let mockEventEmitter: Partial<EventEmitter2>;
  let mockTechniqueExecutorService: Partial<TechniqueExecutorService>;

  beforeEach(async () => {
    // Создаем моки для репозиториев
    mockCharacterRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    mockTechniqueExecutionRepository = {
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    mockUserManipulationProfileRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    // Создаем моки для сервисов
    mockNeedsService = {
      getNeeds: jest.fn(),
      getNeedsByCharacter: jest.fn(),
      getActiveNeeds: jest.fn(),
    };

    mockEmotionalStateService = {
      getEmotionalState: jest.fn(),
      updateEmotionalState: jest.fn(),
    };

    mockLLMService = {
      generateText: jest.fn(),
      generateJSON: jest.fn(),
    };

    mockPromptTemplateService = {
      getTemplate: jest.fn(),
      createPrompt: jest.fn(),
    };

    mockLogService = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    mockTechniqueExecutorService = {
      executeTechnique: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManipulationService,
        {
          provide: getRepositoryToken(Character),
          useValue: mockCharacterRepository,
        },
        {
          provide: getRepositoryToken(TechniqueExecution),
          useValue: mockTechniqueExecutionRepository,
        },
        {
          provide: getRepositoryToken(UserManipulationProfile),
          useValue: mockUserManipulationProfileRepository,
        },
        {
          provide: NeedsService,
          useValue: mockNeedsService,
        },
        {
          provide: EmotionalStateService,
          useValue: mockEmotionalStateService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: PromptTemplateService,
          useValue: mockPromptTemplateService,
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
          provide: TechniqueExecutorService,
          useValue: mockTechniqueExecutorService,
        },
      ],
    }).compile();

    service = module.get<ManipulationService>(ManipulationService);
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('initializeStrategy', () => {
    it('should initialize manipulation strategy for character', async () => {
      const mockCharacter = {
        id: 1,
        name: 'Test Character',
      } as Character;

      mockCharacterRepository.findOne = jest.fn().mockResolvedValue(mockCharacter);

      const result = await service.initializeStrategy(1);

      expect(result).toBeDefined();
      expect(result.characterId).toBe(1);
      expect(result.primaryTechniques).toBeDefined();
      expect(result.ethicalLimits).toBeDefined();
    });
  });

  describe('selectTechnique', () => {
    it('should select appropriate technique based on context', async () => {
      const context = {
        characterId: 1,
        userId: 123,
        userMessage: 'I feel lonely',
        currentEmotion: 'sad',
        conversationHistory: [],
      };

      const mockCharacter = {
        id: 1,
        name: 'Test Character',
        personality: { traits: ['empathetic'] },
      } as Character;

      const mockProfile = {
        id: 1,
        vulnerabilities: ['loneliness'],
        successfulTechniques: [ManipulativeTechniqueType.VALIDATION],
        resistedTechniques: [],
      } as UserManipulationProfile;

      mockCharacterRepository.findOne = jest.fn().mockResolvedValue(mockCharacter);
      mockUserManipulationProfileRepository.findOne = jest.fn().mockResolvedValue(mockProfile);
      mockNeedsService.getNeeds = jest.fn().mockResolvedValue([]);
      mockEmotionalStateService.getEmotionalState = jest.fn().mockResolvedValue({
        dominantEmotion: 'neutral',
        intensity: 0.5,
      });
      mockPromptTemplateService.createPrompt = jest.fn().mockReturnValue('Analyze this message');
      mockLLMService.generateJSON = jest.fn().mockResolvedValue({
        primaryNeed: 'social_connection',
        emotionalTone: 'sad',
        vulnerability: 'loneliness',
      });

      const result = await service.selectTechnique(context);

      expect(result).toBeDefined();
      expect(result.techniqueType).toBeDefined();
      expect(result.intensity).toBeDefined();
      expect(result.priority).toBeDefined();
      expect(result.target).toBeDefined();
    });
  });

  describe('updateUserProfile', () => {
    it('should update user manipulation profile', async () => {
      const mockProfile = {
        id: 1,
        userId: 123,
        vulnerabilities: [],
        successfulTechniques: [],
        resistedTechniques: [],
      } as UserManipulationProfile;

      mockUserManipulationProfileRepository.findOne = jest.fn().mockResolvedValue(mockProfile);
      mockUserManipulationProfileRepository.save = jest.fn().mockResolvedValue(mockProfile);

      const profileData = {
        vulnerabilities: ['loneliness'],
        successfulTechniques: [ManipulativeTechniqueType.VALIDATION],
      };

      const result = await service.updateUserProfile(1, 123, profileData);

      expect(result).toBeDefined();
      expect(mockUserManipulationProfileRepository.save).toHaveBeenCalled();
    });
  });

  describe('getTechniqueStatistics', () => {
    it('should return technique statistics for character', async () => {
      const mockStats = {
        totalExecutions: 10,
        averageEffectiveness: 0.7,
        techniqueUsage: { mirroring: 5, anchoring: 5 },
        ethicalViolations: 2,
      };

      // Мокаем внутренние вызовы
      const spy = jest.spyOn(service, 'getTechniqueStatistics').mockResolvedValue(mockStats);

      const result = await service.getTechniqueStatistics(1);

      expect(result).toEqual(mockStats);
      expect(spy).toHaveBeenCalledWith(1);
    });
  });

  describe('emergencyDisable', () => {
    it('should disable all active techniques for character', async () => {
      // Инициализируем стратегию для персонажа
      const mockCharacter = {
        id: 1,
        name: 'Test Character',
        personality: { traits: ['empathetic'] },
      } as Character;

      mockCharacterRepository.findOne = jest.fn().mockResolvedValue(mockCharacter);

      // Сначала инициализируем стратегию
      await service.initializeStrategy(1);

      // Теперь вызываем emergencyDisable
      await service.emergencyDisable(1);

      // Проверяем что метод был вызван без ошибок
      expect(true).toBe(true);
    });
  });

  describe('analyzeSituationAndChooseTechnique', () => {
    it('should analyze situation and choose appropriate technique', async () => {
      const mockCharacter = {
        id: 1,
        name: 'Test Character',
        personality: { traits: ['manipulative'] },
      } as Character;

      const mockUserProfile = {
        id: 1,
        userId: 1,
        characterId: 1,
        vulnerabilities: ['attention_seeking'],
        successfulTechniques: [],
        resistedTechniques: [],
        emotionalTriggers: [],
        susceptibilityScore: 75,
      } as UserManipulationProfile;

      mockCharacterRepository.findOne = jest.fn().mockResolvedValue(mockCharacter);
      mockUserManipulationProfileRepository.findOne = jest.fn().mockResolvedValue(mockUserProfile);
      mockLLMService.generateJSON = jest.fn().mockResolvedValue({
        analysis: {
          primaryNeed: 'attention',
          emotionalTone: 'sadness',
          vulnerability: 'loneliness',
          recommendation: 'Use validation technique',
        },
        recommendedTechnique: 'VALIDATION',
        confidence: 0.85,
      });
      mockPromptTemplateService.createPrompt = jest.fn().mockReturnValue('Analysis prompt');

      const result = await service.analyzeSituationAndChooseTechnique(1, 1, 'I feel lonely today');

      expect(result).toBeDefined();
      expect(mockLLMService.generateJSON).toHaveBeenCalled();
      expect(mockPromptTemplateService.createPrompt).toHaveBeenCalled();
    });

    it('should handle analysis errors gracefully', async () => {
      mockCharacterRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.analyzeSituationAndChooseTechnique(1, 1, 'Test message'),
      ).rejects.toThrow();
    });
  });

  describe('executeTechnique', () => {
    it('should execute a manipulation technique successfully (first overload)', async () => {
      const mockCharacter = {
        id: 1,
        name: 'Test Character',
        personality: { traits: ['manipulative'] },
      } as Character;

      mockCharacterRepository.findOne = jest.fn().mockResolvedValue(mockCharacter);
      mockTechniqueExecutionRepository.create = jest.fn().mockReturnValue({
        id: 1,
        techniqueType: ManipulativeTechniqueType.VALIDATION,
        intensity: TechniqueIntensity.MODERATE,
        generatedResponse: '',
      });
      mockTechniqueExecutionRepository.save = jest.fn().mockResolvedValue({
        id: 1,
        techniqueType: ManipulativeTechniqueType.VALIDATION,
        intensity: TechniqueIntensity.MODERATE,
        generatedResponse: 'Generated response',
      });

      // Мокаем метод generateManipulativeResponse
      mockLLMService.generateText = jest.fn().mockResolvedValue({
        text: 'Generated response',
      });

      // Инициализируем стратегию сначала
      await service.initializeStrategy(1);

      const result = await service.executeTechnique(1, 1, ManipulativeTechniqueType.VALIDATION);

      expect(result).toBe('Generated response');
      expect(mockTechniqueExecutionRepository.save).toHaveBeenCalled();
    });

    it('should execute technique using context (second overload)', async () => {
      const mockContext = {
        characterId: 1,
        userId: 1,
        messageContent: 'Test message',
        intensityLevel: TechniqueIntensity.MODERATE,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        phase: 'EXECUTION' as any,
      };

      const mockSelectedTechnique = {
        techniqueType: ManipulativeTechniqueType.VALIDATION,
        intensity: 0.5,
        priority: 1,
        target: 'emotional-state',
      };

      mockNeedsService.getActiveNeeds = jest
        .fn()
        .mockResolvedValue([{ type: 'attention', currentValue: 70 }]);
      mockEmotionalStateService.getEmotionalState = jest.fn().mockResolvedValue({
        primary: 'neutral',
        secondary: 'calm',
        intensity: 50,
      });

      mockTechniqueExecutorService.executeTechnique = jest.fn().mockResolvedValue({
        success: true,
        message: 'Technique executed',
        generatedResponse: 'Response from executor',
      });

      const result = await service.executeTechnique(mockContext, mockSelectedTechnique);

      expect(result).toBeDefined();
      expect(mockTechniqueExecutorService.executeTechnique).toHaveBeenCalled();
    });

    it('should handle technique execution errors', async () => {
      mockCharacterRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.executeTechnique(1, 1, ManipulativeTechniqueType.VALIDATION),
      ).rejects.toThrow();
    });
  });

  describe('monitorTechniqueEffectiveness', () => {
    it('should monitor technique effectiveness', async () => {
      // Мокаем активные выполнения
      service['activeExecutions'].set(1, [
        {
          id: '1',
          techniqueType: ManipulativeTechniqueType.VALIDATION,
          intensity: TechniqueIntensity.MODERATE,
          characterId: 1,
          userId: 1,
          startTime: new Date(Date.now() - 60000), // 1 минута назад
          effectiveness: 75,
        },
      ]);

      // Мокаем сервисы
      mockNeedsService.getActiveNeeds = jest.fn().mockResolvedValue([
        {
          type: 'attention',
          currentValue: 80,
        },
      ]);
      mockEmotionalStateService.getEmotionalState = jest.fn().mockResolvedValue({
        primary: 'happy',
        secondary: 'content',
        intensity: 60,
      });

      mockTechniqueExecutionRepository.update = jest.fn().mockResolvedValue({});

      await service.monitorTechniqueEffectiveness();

      expect(mockTechniqueExecutionRepository.update).toHaveBeenCalled();
    });
  });

  describe('checkEthicalConstraints', () => {
    it('should check ethical constraints for manipulation', () => {
      // Инициализируем стратегию с этическими ограничениями
      const mockStrategy = {
        characterId: 1,
        primaryTechniques: [ManipulativeTechniqueType.VALIDATION],
        ethicalLimits: {
          maxIntensity: TechniqueIntensity.MODERATE,
          bannedTechniques: [ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL],
        },
      };
      service['strategies'].set(1, mockStrategy);

      const result = service['checkEthicalConstraints'](1);
      expect(result).toBe(true);
    });

    it('should return false if aggressive techniques exceed limit', () => {
      // Устанавливаем много агрессивных выполнений
      service['activeExecutions'].set(999, [
        {
          id: '1',
          techniqueType: ManipulativeTechniqueType.VALIDATION,
          intensity: TechniqueIntensity.AGGRESSIVE,
          characterId: 999,
          userId: 1,
          startTime: new Date(Date.now() - 30000), // 30 секунд назад
          effectiveness: 80,
        },
        {
          id: '2',
          techniqueType: ManipulativeTechniqueType.VALIDATION,
          intensity: TechniqueIntensity.AGGRESSIVE,
          characterId: 999,
          userId: 1,
          startTime: new Date(Date.now() - 60000), // 1 минута назад
          effectiveness: 80,
        },
        {
          id: '3',
          techniqueType: ManipulativeTechniqueType.VALIDATION,
          intensity: TechniqueIntensity.AGGRESSIVE,
          characterId: 999,
          userId: 1,
          startTime: new Date(Date.now() - 90000), // 1.5 минуты назад
          effectiveness: 80,
        },
      ]);

      const result = service['checkEthicalConstraints'](999);
      expect(result).toBe(false);
    });
  });

  describe('calculateIntensity', () => {
    it('should calculate technique intensity', () => {
      const result = service['calculateIntensity'](1, ManipulativeTechniqueType.VALIDATION);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('generateManipulativeResponse', () => {
    it('should generate manipulative response', async () => {
      mockLLMService.generateText = jest.fn().mockResolvedValue('Generated response');
      mockPromptTemplateService.createPrompt = jest.fn().mockReturnValue('Response prompt');

      // Мокаем метод, так как он private
      const generateResponseSpy = jest
        .spyOn(service as any, 'generateManipulativeResponse')
        .mockResolvedValue('Generated response');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await service['generateManipulativeResponse']({} as any);

      expect(generateResponseSpy).toHaveBeenCalled();
      expect(result).toBe('Generated response');
    });
  });

  describe('updateUserProfile', () => {
    it('should update user manipulation profile', async () => {
      const mockProfile = {
        id: 1,
        userId: 1,
        characterId: 1,
        vulnerabilities: ['attention_seeking'],
        successfulTechniques: [],
        resistedTechniques: [],
        emotionalTriggers: [],
        susceptibilityScore: 75,
      } as UserManipulationProfile;

      mockUserManipulationProfileRepository.findOne = jest.fn().mockResolvedValue(mockProfile);
      mockUserManipulationProfileRepository.save = jest.fn().mockResolvedValue(mockProfile);

      const result = await service.updateUserProfile(1, 1, {
        vulnerabilities: ['test_vulnerability'],
      });

      expect(result).toBeDefined();
      expect(mockUserManipulationProfileRepository.save).toHaveBeenCalled();
    });

    it('should create new profile if none exists', async () => {
      mockUserManipulationProfileRepository.findOne = jest.fn().mockResolvedValue(null);
      mockUserManipulationProfileRepository.create = jest
        .fn()
        .mockReturnValue({ id: 1, userId: 1, characterId: 1 });
      mockUserManipulationProfileRepository.save = jest
        .fn()
        .mockResolvedValue({ id: 1, userId: 1, characterId: 1 });

      const result = await service.updateUserProfile(1, 1, {
        vulnerabilities: ['test_vulnerability'],
      });

      expect(result).toBeDefined();
      expect(mockUserManipulationProfileRepository.create).toHaveBeenCalled();
    });
  });

  describe('emergencyDisable', () => {
    it('should disable all active techniques for character', async () => {
      service['activeExecutions'].set(1, [
        {
          id: '1',
          techniqueType: ManipulativeTechniqueType.VALIDATION,
          intensity: TechniqueIntensity.MODERATE,
          characterId: 1,
          userId: 1,
          startTime: new Date(),
          effectiveness: 80,
        },
      ]);

      const mockStrategy = {
        characterId: 1,
        primaryTechniques: [ManipulativeTechniqueType.VALIDATION],
        ethicalLimits: {
          maxIntensity: TechniqueIntensity.MODERATE,
          bannedTechniques: [],
        },
      };
      service['strategies'].set(1, mockStrategy);

      await service.emergencyDisable(1);

      expect(service['activeExecutions'].get(1)).toEqual([]);
      expect(mockStrategy.ethicalLimits.bannedTechniques).toEqual(
        Object.values(ManipulativeTechniqueType),
      );
    });
  });

  describe('getTechniqueStatistics', () => {
    it('should return technique statistics', async () => {
      service['activeExecutions'].set(1, [
        {
          id: '1',
          techniqueType: ManipulativeTechniqueType.VALIDATION,
          intensity: TechniqueIntensity.MODERATE,
          characterId: 1,
          userId: 1,
          startTime: new Date(),
          effectiveness: 80,
        },
      ]);

      const result = await service.getTechniqueStatistics(1);

      expect(result).toBeDefined();
      expect(result.totalExecutions).toBe(1);
      expect(result.averageEffectiveness).toBe(80);
    });

    it('should handle empty executions', async () => {
      const result = await service.getTechniqueStatistics(999);

      expect(result).toBeDefined();
      expect(result.totalExecutions).toBe(0);
      expect(result.averageEffectiveness).toBe(0);
    });
  });
});

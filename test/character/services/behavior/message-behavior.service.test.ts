import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageBehaviorService } from '../../../../src/character/services/behavior/message-behavior.service';
import { Character } from '../../../../src/character/entities/character.entity';
import {
  CharacterMemory,
  MemoryImportanceLevel,
} from '../../../../src/character/entities/character-memory.entity';
import { LLMService } from '../../../../src/llm/services/llm.service';
import { MessageAnalysisService } from '../../../../src/character/services/analysis/message-analysis.service';
import { ManipulationService } from '../../../../src/character/services/manipulation/manipulation.service';
import { MemoryService } from '../../../../src/character/services/core/memory.service';
import { LogService } from '../../../../src/logging/log.service';
import { MockLogService } from '../../../../lib/tester/mocks/log.service.mock';
import { MessageAnalysis } from '../../../../src/character/interfaces/analysis.interfaces';
import { MemoryType } from '../../../../src/character/interfaces/memory.interfaces';
import { CharacterArchetype } from '../../../../src/character/enums/character-archetype.enum';

describe('MessageBehaviorService', () => {
  let service: MessageBehaviorService;
  let characterRepository: jest.Mocked<Repository<Character>>;
  let memoryRepository: jest.Mocked<Repository<CharacterMemory>>;
  let llmService: jest.Mocked<LLMService>;
  let messageAnalysisService: jest.Mocked<MessageAnalysisService>;
  let manipulationService: jest.Mocked<ManipulationService>;
  let memoryService: jest.Mocked<MemoryService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let logService: MockLogService;

  const mockCharacter: Character = {
    id: 1,
    name: 'Test Character',
    fullName: 'Test Character Full Name',
    description: 'Test Description',
    systemPrompt: 'Test System Prompt',
    age: 25,
    gender: 'male',
    archetype: CharacterArchetype.COMPANION,
    personalityData: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Character;

  const mockMemory: CharacterMemory = {
    id: 1,
    characterId: 1,
    content: 'Test memory content',
    type: MemoryType.CONVERSATION,
    importance: MemoryImportanceLevel.AVERAGE,
    memoryDate: new Date(),
    recallCount: 0,
    lastRecalled: null,
    isActive: true,
    isLongTerm: false,
    summary: 'Test memory summary',
    metadata: {},
    embedding: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as CharacterMemory;

  const mockMessageAnalysis: MessageAnalysis = {
    urgency: 0.3,
    userIntent: 'casual_talk',
    needsImpact: {
      social: 0.5,
      achievement: 0.2,
    },
    emotionalAnalysis: {
      userMood: 'positive',
      emotionalIntensity: 0.6,
      triggerEmotions: ['joy', 'excitement'],
      expectedEmotionalResponse: 'positive',
    },
    manipulationAnalysis: {
      userVulnerability: 0.2,
      applicableTechniques: [],
      riskLevel: 'low',
      recommendedIntensity: 0.1,
    },
    specializationAnalysis: {
      responseComplexityLevel: 'simple',
      requiredKnowledge: ['basic_conversation'],
      domain: 'general',
    },
    behaviorAnalysis: {
      interactionType: 'casual',
      conversationDirection: 'continue',
      userIntent: 'greeting',
      keyTopics: ['greeting', 'casual_talk'],
    },
    analysisMetadata: {
      confidence: 0.85,
      processingTime: 150,
      llmProvider: 'openai',
      analysisVersion: '1.0',
      timestamp: new Date(),
    },
  };

  const mockBehaviorContext = {
    emotionalState: null,
    motivations: [],
    currentAction: null,
    recentMemories: [mockMemory],
  };

  const mockBehaviorPattern = {
    type: 'friendly',
    description: 'Friendly behavior pattern',
  };

  beforeEach(async () => {
    const mockRepositoryFactory = () => ({
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    });

    logService = new MockLogService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageBehaviorService,
        {
          provide: getRepositoryToken(Character),
          useFactory: mockRepositoryFactory,
        },
        {
          provide: getRepositoryToken(CharacterMemory),
          useFactory: mockRepositoryFactory,
        },
        {
          provide: LLMService,
          useValue: {
            generateText: jest.fn(),
          },
        },
        {
          provide: MessageAnalysisService,
          useValue: {
            analyzeUserMessage: jest.fn(),
          },
        },
        {
          provide: ManipulationService,
          useValue: {
            analyzeSituationAndChooseTechnique: jest.fn(),
          },
        },
        {
          provide: MemoryService,
          useValue: {
            createMemory: jest.fn(),
            limitMemoriesCount: jest.fn(),
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
          useValue: logService,
        },
      ],
    }).compile();

    service = module.get<MessageBehaviorService>(MessageBehaviorService);
    characterRepository = module.get(getRepositoryToken(Character));
    memoryRepository = module.get(getRepositoryToken(CharacterMemory));
    llmService = module.get(LLMService);
    messageAnalysisService = module.get(MessageAnalysisService);
    manipulationService = module.get(ManipulationService);
    memoryService = module.get(MemoryService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('processIncomingMessage', () => {
    it('should process incoming message successfully', async () => {
      const message = 'Hello, how are you?';
      const expectedResponse = 'Hi there! I am doing well, thank you for asking.';

      characterRepository.findOne.mockResolvedValue(mockCharacter);
      messageAnalysisService.analyzeUserMessage.mockResolvedValue(mockMessageAnalysis);
      llmService.generateText.mockResolvedValue({ text: expectedResponse });

      const result = await service.processIncomingMessage(
        1,
        1,
        message,
        mockBehaviorContext,
        mockBehaviorPattern,
      );

      expect(messageAnalysisService.analyzeUserMessage).toHaveBeenCalledWith(
        mockCharacter,
        message,
        [],
      );
      expect(llmService.generateText).toHaveBeenCalled();
      expect(result.text).toBe(expectedResponse);
      expect(result.analysis).toEqual(mockMessageAnalysis);
      expect(result.contextUsed).toEqual(mockBehaviorContext);
    });

    it('should handle analysis failure gracefully', async () => {
      const message = 'Test message';
      const error = new Error('Analysis failed');

      characterRepository.findOne.mockResolvedValue(mockCharacter);
      messageAnalysisService.analyzeUserMessage.mockRejectedValue(error);

      await expect(
        service.processIncomingMessage(1, 1, message, mockBehaviorContext, mockBehaviorPattern),
      ).rejects.toThrow('Analysis failed');
    });

    it('should handle LLM generation failure gracefully', async () => {
      const message = 'Test message';
      const error = new Error('LLM generation failed');

      characterRepository.findOne.mockResolvedValue(mockCharacter);
      messageAnalysisService.analyzeUserMessage.mockResolvedValue(mockMessageAnalysis);
      llmService.generateText.mockRejectedValue(error);

      await expect(
        service.processIncomingMessage(1, 1, message, mockBehaviorContext, mockBehaviorPattern),
      ).rejects.toThrow('LLM generation failed');
    });
  });

  describe('processUserMessageWithAnalysis', () => {
    it('should process user message with analysis successfully', async () => {
      memoryRepository.create.mockReturnValue(mockMemory);
      memoryRepository.save.mockResolvedValue(mockMemory);

      await service.processUserMessageWithAnalysis(1, 1, 'Test message', mockMessageAnalysis, 1);

      expect(memoryRepository.create).toHaveBeenCalled();
      expect(memoryRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('manipulation.analyze_message', {
        characterId: 1,
        userId: 1,
        messageText: 'Test message',
        timestamp: expect.any(Date) as Date,
      });
    });

    it('should handle memory creation failure gracefully', async () => {
      const error = new Error('Memory creation failed');

      memoryRepository.create.mockReturnValue(mockMemory);
      memoryRepository.save.mockRejectedValue(error);

      await expect(
        service.processUserMessageWithAnalysis(1, 1, 'Test message', mockMessageAnalysis),
      ).rejects.toThrow('Memory creation failed');
    });
  });

  describe('service initialization', () => {
    it('should have all required dependencies', () => {
      expect(characterRepository).toBeDefined();
      expect(memoryRepository).toBeDefined();
      expect(llmService).toBeDefined();
      expect(messageAnalysisService).toBeDefined();
      expect(manipulationService).toBeDefined();
      expect(memoryService).toBeDefined();
      expect(eventEmitter).toBeDefined();
      expect(logService).toBeDefined();
    });
  });
});

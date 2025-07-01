/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { MessageProcessingCoordinator } from '../../src/character/services/message-processing-coordinator.service';
import { MessageAnalysisService } from '../../src/character/services/message-analysis.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { CharacterBehaviorService } from '../../src/character/services/character-behavior.service';
import { CharacterResponseService } from '../../src/character/services/character-response.service';
import { EmotionalStateService } from '../../src/character/services/emotional-state.service';
import { ManipulationService } from '../../src/character/services/manipulation.service';
import { TechniqueExecutorService } from '../../src/character/services/technique-executor.service';
import { ActionExecutorService } from '../../src/character/services/action-executor.service';
import { TechniqueStrategyService } from '../../src/character/services/technique-strategy.service';
import { TechniqueValidatorService } from '../../src/character/services/technique-validator.service';
import { TechniqueAnalyzerService } from '../../src/character/services/technique-analyzer.service';
import { TechniqueGeneratorService } from '../../src/character/services/technique-generator.service';
import { TechniqueAdapterService } from '../../src/character/services/technique-adapter.service';
import { TechniqueHistoryService } from '../../src/character/services/technique-history.service';
import { SpecializationService } from '../../src/character/services/specialization.service';
import { CharacterService } from '../../src/character/services/character.service';
import { Character } from '../../src/character/entities/character.entity';
import { Need } from '../../src/character/entities/need.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LLMService } from '../../src/llm/services/llm.service';
import { UserService } from '../../src/user/services/user.service';
import { PromptTemplateService } from '../../src/prompt-template/prompt-template.service';
import { CharacterMemory } from '../../src/character/entities/character-memory.entity';
import { ActionService } from '../../src/character/services/action.service';
import { MemoryService } from '../../src/character/services/memory.service';
import { ConfigService } from '@nestjs/config';
import {
  TechniqueExecution,
  UserManipulationProfile,
} from '../../src/character/entities/manipulation-technique.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MockEventEmitter } from '../../lib/tester/mocks/event-emitter.mock';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { MessageBehaviorService } from '../../src/character/services/message-behavior.service';
import { EmotionalBehaviorService } from '../../src/character/services/emotional-behavior.service';

createTestSuite('MessageProcessingCoordinator Integration Tests', () => {
  let fixtureManager: FixtureManager;

  beforeAll(async () => {
    // Используем mock fixtureManager без реальной БД
    fixtureManager = {
      createUser: jest.fn().mockResolvedValue({
        id: '1',
        telegramId: '123456789',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      createCharacter: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Тестовый персонаж',
        age: 25,
        archetype: CharacterArchetype.HERO,
        telegramId: '123456789',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      cleanDatabase: jest.fn().mockResolvedValue(undefined),
    } as any;
  });

  createTest(
    {
      name: 'test message processing',
      configType: TestConfigType.BASIC, // Используем BASIC вместо INTEGRATION
      providers: [
        MessageProcessingCoordinator,
        MessageAnalysisService,
        NeedsService,
        CharacterBehaviorService,
        CharacterResponseService,
        EmotionalStateService,
        ManipulationService,
        TechniqueExecutorService,
        ActionExecutorService,
        TechniqueStrategyService,
        TechniqueValidatorService,
        TechniqueAnalyzerService,
        TechniqueGeneratorService,
        TechniqueAdapterService,
        TechniqueHistoryService,
        SpecializationService,
        CharacterService,
        {
          provide: LLMService,
          useValue: {
            onModuleInit: jest.fn(),
            generate: jest.fn().mockResolvedValue({ content: 'test' }),
          },
        },
        {
          provide: getRepositoryToken(Character),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Need),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            findById: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: PromptTemplateService,
          useValue: {
            getTemplate: jest.fn().mockReturnValue('template'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
        {
          provide: getRepositoryToken(CharacterMemory),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: ActionService,
          useValue: {
            createActionWithResources: jest.fn(),
            executeActionWithResources: jest.fn(),
          },
        },
        {
          provide: MemoryService,
          useValue: {
            createMemory: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TechniqueExecution),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserManipulationProfile),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: new MockEventEmitter(),
        },
        {
          provide: MessageBehaviorService,
          useValue: {
            processIncomingMessage: jest.fn().mockResolvedValue({
              text: 'Test response',
              analysis: { urgency: 0.5 },
              contextUsed: {},
            }),
            processUserMessageWithAnalysis: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EmotionalBehaviorService,
          useValue: {
            analyzeFrustration: jest.fn().mockResolvedValue('none'),
            handleEmotionalStateChanged: jest.fn().mockResolvedValue(undefined),
            getFrustrationLevel: jest.fn().mockReturnValue('none'),
            getActiveFrustrationPatterns: jest.fn().mockReturnValue([]),
            applyFrustrationToAction: jest.fn().mockReturnValue(0.8),
          },
        },
      ],
    },
    async context => {
      const service = context.get(MessageProcessingCoordinator);
      const characterRepo = context.get(getRepositoryToken(Character));
      const needRepo = context.get(getRepositoryToken(Need));

      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({
        user,
        userId: user.id,
      });

      characterRepo.findOne.mockResolvedValue(character);
      needRepo.find.mockResolvedValue([]);

      const result = await service.processUserMessage(character, user.id, 'Hello', []);

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.analysis).toBeDefined();
    },
  );
});

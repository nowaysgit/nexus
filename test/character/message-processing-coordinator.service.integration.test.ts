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
import { DataSource } from 'typeorm';
import { Tester } from '../../lib/tester';
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

createTestSuite('MessageProcessingCoordinator Integration Tests', () => {
  let tester: Tester;
  let fixtureManager: FixtureManager;
  let dataSource: DataSource;

  beforeAll(async () => {
    tester = Tester.getInstance();
    dataSource = await tester.setupTestEnvironment(TestConfigType.INTEGRATION);
    fixtureManager = new FixtureManager(dataSource);
  });
  afterAll(async () => {
    await tester.forceCleanup();
  });
  beforeEach(async () => {
    await fixtureManager.cleanDatabase();
  });

  createTest(
    {
      name: 'test message processing',
      configType: TestConfigType.INTEGRATION,
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

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  createTestSuite,
  createTest,
  TestConfigType,
  createTestDataSource,
} from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';

import { TechniqueExecutorService } from '../../src/character/services/technique-executor.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { EmotionalStateService } from '../../src/character/services/emotional-state.service';
import { LLMService } from '../../src/llm/services/llm.service';
import { PromptTemplateService } from '../../src/prompt-template/prompt-template.service';
import { LogService } from '../../src/logging/log.service';
import { RollbarService } from '../../src/logging/rollbar.service';

import { Character } from '../../src/character/entities/character.entity';
import { User } from '../../src/user/entities/user.entity';
import { TechniqueExecution } from '../../src/character/entities/manipulation-technique.entity';

import { ITechniqueContext } from '../../src/character/interfaces/technique.interfaces';
import { IEmotionalState } from '../../src/character/interfaces/emotional-state.interface';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
  TechniquePhase,
} from '../../src/character/enums/technique.enums';

import { MockLogService, MockRollbarService } from '../../lib/tester/mocks';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

createTestSuite('TechniqueExecutorService Integration Tests', () => {
  let fixtureManager: FixtureManager;
  let service: TechniqueExecutorService;
  let moduleRef: TestingModule;
  let llmService: jest.Mocked<Pick<LLMService, 'generateText'>>;

  beforeAll(async () => {
    const dataSource = await createTestDataSource();
    fixtureManager = new FixtureManager(dataSource);

    const mockLLMService = {
      generateText: jest.fn().mockResolvedValue('...'),
    };
    llmService = mockLLMService as jest.Mocked<Pick<LLMService, 'generateText'>>;

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.test' }),
        TypeOrmModule.forFeature([Character, User, TechniqueExecution]),
      ],
      providers: [
        TechniqueExecutorService,
        { provide: NeedsService, useValue: { getActiveNeeds: jest.fn().mockResolvedValue([]) } },
        {
          provide: EmotionalStateService,
          useValue: { getEmotionalState: jest.fn().mockResolvedValue({}) },
        },
        { provide: LLMService, useValue: llmService },
        {
          provide: PromptTemplateService,
          useValue: { createPrompt: jest.fn().mockReturnValue('...') },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: LogService, useClass: MockLogService },
        { provide: RollbarService, useClass: MockRollbarService },
        { provide: WINSTON_MODULE_PROVIDER, useValue: { info: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get<TechniqueExecutorService>(TechniqueExecutorService);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(async () => {
    await fixtureManager.cleanDatabase();
  });

  createTest(
    { name: 'должен быть определен', configType: TestConfigType.INTEGRATION },
    async () => {
      expect(service).toBeDefined();
    },
  );

  createTest(
    { name: 'должен выполнять технику с контекстом', configType: TestConfigType.INTEGRATION },
    async () => {
      const user = await fixtureManager.createUser({});
      const character = await fixtureManager.createCharacter({ user: user });

      const emotionalState: IEmotionalState = {
        primary: 'neutral',
        secondary: 'focused',
        current: 'neutral',
      };
      const techniqueContext: ITechniqueContext = {
        user: user,
        character: character,
        messageContent: 'Тестовое сообщение',
        currentPhase: TechniquePhase.EXECUTION,
        previousResults: [],
        emotionalState: emotionalState,
        needsState: { AFFECTION: 45, VALIDATION: 60 },
        previousInteractions: 5,
        conversationHistory: ['История 1', 'История 2'],
        relationshipLevel: 45,
      };

      llmService.generateText.mockResolvedValue({
        text: 'Тестовый сгенерированный ответ',
        requestInfo: {
          model: 'test-model',
          requestId: 'test-request-id',
          fromCache: false,
          executionTime: 100,
        },
      });

      const result = await service.executeTechnique(
        ManipulativeTechniqueType.PUSH_PULL,
        TechniqueIntensity.MODERATE,
        TechniquePhase.EXECUTION,
        techniqueContext,
      );

      expect(result).toBeDefined();
      expect(result.generatedResponse).toBe('Тестовый сгенерированный ответ');
      expect(result.success).toBe(true);
    },
  );
});

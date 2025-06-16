import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { MockNeedsService } from '../../lib/tester/mocks/needs-service.mock';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';

import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TechniqueExecutorService } from '../../src/character/services/technique-executor.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { EmotionalStateService } from '../../src/character/services/emotional-state.service';
import { LLMService } from '../../src/llm/services/llm.service';
import { PromptTemplateService } from '../../src/prompt-template/prompt-template.service';

import { ALL_TEST_ENTITIES } from '../../lib/tester/entities';

import { ITechniqueContext } from '../../src/character/interfaces/technique.interfaces';
import { IEmotionalState } from '../../src/character/interfaces/emotional-state.interface';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
  TechniquePhase,
} from '../../src/character/enums/technique.enums';

import { TestingModule } from '@nestjs/testing';

createTestSuite('TechniqueExecutorService Integration Tests', () => {
  let fixtureManager: FixtureManager;
  let service: TechniqueExecutorService;
  let moduleRef: TestingModule;
  let llmService: jest.Mocked<Pick<LLMService, 'generateText'>>;

  beforeAll(async () => {
    const mockLLMService = {
      generateText: jest.fn().mockResolvedValue('...'),
    };
    llmService = mockLLMService as jest.Mocked<Pick<LLMService, 'generateText'>>;

    moduleRef = await TestModuleBuilder.create()
      .withImports([
        // MockTypeOrmModule автоматически добавляется через TestConfigurations
        TypeOrmModule.forFeature(ALL_TEST_ENTITIES),
      ])
      .withProviders([
        TechniqueExecutorService,
        { provide: NeedsService, useClass: MockNeedsService },
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
      ])
      .withRequiredMocks()
      .compile();

    const dataSource = moduleRef.get<DataSource>('DATA_SOURCE');
    fixtureManager = new FixtureManager(dataSource);
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
    },
  );
});

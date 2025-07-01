import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { MockNeedsService } from '../../lib/tester/mocks/needs-service.mock';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';

import { TechniqueExecutorService } from '../../src/character/services/technique-executor.service';
import { TechniqueStrategyService } from '../../src/character/services/technique-strategy.service';
import { TechniqueValidatorService } from '../../src/character/services/technique-validator.service';
import { TechniqueAnalyzerService } from '../../src/character/services/technique-analyzer.service';
import { TechniqueGeneratorService } from '../../src/character/services/technique-generator.service';
import { TechniqueAdapterService } from '../../src/character/services/technique-adapter.service';
import { TechniqueHistoryService } from '../../src/character/services/technique-history.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { EmotionalStateService } from '../../src/character/services/emotional-state.service';
import { LLMService } from '../../src/llm/services/llm.service';
import { PromptTemplateService } from '../../src/prompt-template/prompt-template.service';

import { ITechniqueContext } from '../../src/character/interfaces/technique.interfaces';
import { IEmotionalState } from '../../src/character/interfaces/emotional-state.interface';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
  TechniquePhase,
} from '../../src/character/enums/technique.enums';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { User } from '../../src/user/entities/user.entity';
import { Character, CharacterGender } from '../../src/character/entities/character.entity';

import { TestingModule } from '@nestjs/testing';

createTestSuite('TechniqueExecutorService Integration Tests', () => {
  let service: TechniqueExecutorService;
  let moduleRef: TestingModule;
  let llmService: jest.Mocked<Pick<LLMService, 'generateText'>>;

  beforeAll(async () => {
    const mockLLMService = {
      generateText: jest.fn().mockResolvedValue('...'),
    };
    llmService = mockLLMService as jest.Mocked<Pick<LLMService, 'generateText'>>;

    moduleRef = await TestModuleBuilder.create()
      .withProviders([
        TechniqueExecutorService,
        // Добавляем все специализированные сервисы техник
        TechniqueStrategyService,
        TechniqueValidatorService,
        TechniqueAnalyzerService,
        TechniqueGeneratorService,
        TechniqueAdapterService,
        TechniqueHistoryService,
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

    service = moduleRef.get<TechniqueExecutorService>(TechniqueExecutorService);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  createTest({ name: 'должен быть определен', configType: TestConfigType.BASIC }, async () => {
    expect(service).toBeDefined();
  });

  createTest(
    { name: 'должен выполнять технику с контекстом', configType: TestConfigType.BASIC },
    async () => {
      // Создаем моки пользователя и персонажа
      const user: Partial<User> = {
        id: '1',
        telegramId: '123456789',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const character: Partial<Character> = {
        id: 1,
        name: 'Тестовый персонаж',
        fullName: 'Тестовый персонаж Полное имя',
        age: 25,
        gender: CharacterGender.FEMALE,
        archetype: CharacterArchetype.HERO,
        biography: 'Тестовая биография',
        appearance: 'Тестовое описание внешности',
        personality: {
          traits: ['дружелюбный'],
          hobbies: ['чтение'],
          fears: ['темнота'],
          values: ['честность'],
          musicTaste: ['поп'],
          strengths: ['эмпатия'],
          weaknesses: ['нетерпеливость'],
        },
        user: user as User,
        userId: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const emotionalState: IEmotionalState = {
        primary: 'neutral',
        secondary: 'focused',
        current: 'neutral',
      };
      const techniqueContext: ITechniqueContext = {
        user: user as User,
        character: character as Character,
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

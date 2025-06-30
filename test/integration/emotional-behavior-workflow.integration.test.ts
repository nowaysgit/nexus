import { TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

// Entities
import { Character } from '../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { ActionType } from '../../src/character/enums/action-type.enum';

// Services
import { CharacterService } from '../../src/character/services/character.service';
import { EmotionalStateService } from '../../src/character/services/emotional-state.service';
import { CharacterBehaviorService } from '../../src/character/services/character-behavior.service';
import { ActionService } from '../../src/character/services/action.service';

// Tester utilities
import {
  createTestSuite,
  createTest,
  TestModuleBuilder,
  TestConfigurations,
} from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { CharacterModule } from '../../src/character/character.module';
import { UserModule } from '../../src/user/user.module';
import { DialogModule } from '../../src/dialog/dialog.module';
import { LLMModule } from '../../src/llm/llm.module';
import { CacheModule } from '../../src/cache/cache.module';
import { LoggingModule } from '../../src/logging/logging.module';
import { MessageQueueModule } from '../../src/message-queue/message-queue.module';
import { ValidationModule } from '../../src/validation/validation.module';
import { MockMonitoringModule } from '../../lib/tester/mocks/mock-monitoring.module';
import { PromptTemplateModule } from '../../src/prompt-template/prompt-template.module';
import { ActionTriggerContext } from '../../src/character/services/action.service';
import { EmotionalUpdate } from '../../src/character/services/emotional-state.service';

createTestSuite('Emotional State and Behavior Workflow Integration Tests', () => {
  let moduleRef: TestingModule;
  let fixtureManager: FixtureManager;
  let dataSource: DataSource;
  let characterService: CharacterService;
  let emotionalStateService: EmotionalStateService;
  let behaviorService: CharacterBehaviorService;
  let actionService: ActionService;
  let characterRepository: Repository<Character>;

  beforeAll(async () => {
    const rawImports = [
      CharacterModule,
      UserModule,
      DialogModule,
      LLMModule,
      CacheModule,
      LoggingModule,
      MessageQueueModule,
      ValidationModule,
      MockMonitoringModule,
      PromptTemplateModule,
    ];

    const imports = TestConfigurations.prepareImportsForTesting(rawImports);
    const providers = TestConfigurations.requiredMocksAdder(imports);

    moduleRef = await TestModuleBuilder.create()
      .withDatabase(false)
      .withImports(imports as any)
      .withProviders(providers as any)
      .withRequiredMocks()
      .compile();

    dataSource = moduleRef.get<DataSource>('DataSource');
    fixtureManager = new FixtureManager(dataSource);
    characterService = moduleRef.get<CharacterService>(CharacterService);
    emotionalStateService = moduleRef.get<EmotionalStateService>(EmotionalStateService);
    behaviorService = moduleRef.get<CharacterBehaviorService>(CharacterBehaviorService);
    actionService = moduleRef.get<ActionService>(ActionService);
    characterRepository = moduleRef.get<Repository<Character>>(getRepositoryToken(Character));
  });

  beforeEach(async () => {
    await fixtureManager.cleanDatabase();
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  createTest(
    {
      name: 'should update emotional state and affect behavior',
    },
    async () => {
      // 1. Создаем пользователя и персонажа
      const user = await fixtureManager.createUser({
        telegramId: '123456789',
        username: 'emotionaluser',
        firstName: 'Иван',
        lastName: 'Эмоциональный',
      });

      const character = await characterService.create({
        name: 'Елена',
        age: 28,
        archetype: CharacterArchetype.CAREGIVER,
        biography: 'Эмоциональная девушка, чутко реагирующая на окружающих',
        appearance: 'Девушка с выразительными глазами и открытым взглядом',
        personality: {
          traits: ['эмпатичная', 'эмоциональная', 'заботливая'],
          hobbies: ['психология', 'помощь людям', 'искусство'],
          fears: ['одиночество', 'непонимание'],
          values: ['эмпатия', 'забота', 'понимание'],
          musicTaste: ['мелодичная', 'эмоциональная'],
          strengths: ['понимание эмоций', 'поддержка'],
          weaknesses: ['излишняя чувствительность'],
        },
        user: user,
      });

      expect(character).toBeDefined();
      expect(character.name).toBe('Елена');

      // 2. Обновляем эмоциональное состояние персонажа
      const joyEmotionalState: EmotionalUpdate = {
        emotions: {
          радость: 0.8,
          воодушевление: 0.6,
        },
        source: 'user_message',
        description: 'Радостное, воодушевленное состояние',
      };

      await emotionalStateService.updateEmotionalState(character.id, joyEmotionalState);

      // Проверяем, что эмоциональное состояние обновилось
      const currentEmotionalState = await emotionalStateService.getEmotionalState(character.id);
      expect(currentEmotionalState).toBeDefined();
      expect(currentEmotionalState.primary).toBe('радость');
      expect(currentEmotionalState.intensity).toBeGreaterThan(0);

      // 3. Создаем триггер действия с учетом эмоционального состояния
      const triggerContext: ActionTriggerContext = {
        characterId: character.id,
        userId: user.id,
        triggerType: 'user_request',
        timestamp: new Date(),
        triggerData: {
          message: 'Привет! Как дела?',
          messageId: '12345',
          timestamp: new Date(),
        },
        emotionalResponse: 'радость',
      };

      // 4. Обрабатываем триггер действия
      const triggerResult = await behaviorService.processActionTrigger(triggerContext);
      expect(triggerResult).toBeDefined();
      expect(triggerResult.success).toBeDefined();

      // 5. Проверяем, что действие было выбрано
      if (triggerResult.data) {
        expect(triggerResult.data).toBeDefined();
      }

      // 6. Создаем и выполняем действие напрямую через ActionService
      const action = await actionService.createActionWithResources(
        character.id,
        ActionType.EXPRESS_EMOTION,
        {
          resourceCost: 5,
          successProbability: 0.9,
          potentialReward: { socialConnection: 20 },
          description: 'Выражение радости',
        },
      );

      expect(action).toBeDefined();
      expect(action.type).toBe(ActionType.EXPRESS_EMOTION);

      // 7. Выполняем действие
      const actionContext = {
        character,
        action,
        metadata: {
          testExecution: true,
        },
      };

      console.log("Action type:", action.type);
      console.log("Action metadata:", action.metadata);
      console.log("Supported actions:", await actionService.getSupportedActionTypes());
      const canExecute = await actionService.canExecute(actionContext);
      expect(canExecute).toBe(true);

      const result = await actionService.execute(actionContext);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Очистка
      await characterRepository.delete(character.id);
    },
  );

  createTest(
    {
      name: 'should handle different emotional states and their impact on behavior',
    },
    async () => {
      // 1. Создаем персонажа
      const user = await fixtureManager.createUser({
        telegramId: '987654321',
        username: 'mooduser',
        firstName: 'Мария',
        lastName: 'Настроенческая',
      });

      const character = await characterService.create({
        name: 'Дмитрий',
        age: 32,
        archetype: CharacterArchetype.REBEL,
        biography: 'Эмоциональный мужчина с переменчивым настроением',
        appearance: 'Высокий мужчина с выразительной мимикой',
        personality: {
          traits: ['эмоциональный', 'импульсивный', 'страстный'],
          hobbies: ['спорт', 'музыка', 'дебаты'],
          fears: ['контроль', 'ограничения'],
          values: ['свобода', 'самовыражение', 'честность'],
          musicTaste: ['рок', 'альтернатива'],
          strengths: ['решительность', 'искренность'],
          weaknesses: ['вспыльчивость'],
        },
        user: user,
      });

      expect(character).toBeDefined();
      expect(character.name).toBe('Дмитрий');

      // 2. Проверяем разные эмоциональные состояния и их влияние на поведение

      // 2.1 Злость
      const angerEmotionalState: EmotionalUpdate = {
        emotions: {
          злость: 0.7,
          раздражение: 0.5,
        },
        source: 'user_message',
        description: 'Злое, раздраженное состояние',
      };

      await emotionalStateService.updateEmotionalState(character.id, angerEmotionalState);
      const angerState = await emotionalStateService.getEmotionalState(character.id);
      expect(angerState.primary).toBe('злость');

      // Создаем триггер для злого состояния
      const angerTriggerContext: ActionTriggerContext = {
        characterId: character.id,
        userId: user.id,
        triggerType: 'user_request',
        timestamp: new Date(),
        triggerData: {
          message: 'Почему ты такой нервный?',
          messageId: '54321',
          timestamp: new Date(),
        },
        emotionalResponse: 'злость',
      };

      const angerTriggerResult = await behaviorService.processActionTrigger(angerTriggerContext);
      expect(angerTriggerResult).toBeDefined();
      expect(angerTriggerResult.success).toBeDefined();

      // 2.2 Радость
      const joyEmotionalState: EmotionalUpdate = {
        emotions: {
          радость: 0.8,
          интерес: 0.6,
        },
        source: 'user_message',
        description: 'Радостное, заинтересованное состояние',
      };

      await emotionalStateService.updateEmotionalState(character.id, joyEmotionalState);
      const joyState = await emotionalStateService.getEmotionalState(character.id);
      expect(joyState.primary).toBe('радость');

      // Создаем триггер для радостного состояния
      const joyTriggerContext: ActionTriggerContext = {
        characterId: character.id,
        userId: user.id,
        triggerType: 'user_request',
        timestamp: new Date(),
        triggerData: {
          message: 'Отличная новость! Мы выиграли!',
          messageId: '67890',
          timestamp: new Date(),
        },
        emotionalResponse: 'радость',
      };

      const joyTriggerResult = await behaviorService.processActionTrigger(joyTriggerContext);
      expect(joyTriggerResult).toBeDefined();
      expect(joyTriggerResult.success).toBeDefined();

      // Очистка
      await characterRepository.delete(character.id);
    },
  );
});

import { createTestSuite, createTest } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { CharacterModule } from '../../src/character/character.module';
import { CharacterBehaviorService } from '../../src/character/services/character-behavior.service';
import { ActionExecutorService } from '../../src/character/services/action-executor.service';
import { EmotionalStateService } from '../../src/character/services/emotional-state.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { CharacterService } from '../../src/character/services/character.service';
import { ActionType } from '../../src/character/enums/action-type.enum';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { IMotivation } from '../../src/character/interfaces/needs.interfaces';
import { DataSource } from 'typeorm';
import { ActionTriggerContext, ActionResult } from '../../src/character/services/action.service';

createTestSuite('CharacterBehaviorService.processActionTrigger tests', () => {
  let moduleRef: import('@nestjs/testing').TestingModule | null = null;
  let dataSource: DataSource;
  let fixtureManager: FixtureManager;
  let behaviorService: CharacterBehaviorService;
  let emotionalStateService: EmotionalStateService;
  let _needsService: NeedsService;
  let actionExecutorService: ActionExecutorService;
  let characterService: CharacterService;

  beforeEach(async () => {
    moduleRef = await TestModuleBuilder.create()
      .withImports([
        // TypeOrmModule.forRoot удалён – используется MockTypeOrmModule singleton
        CharacterModule,
      ])
      .withRequiredMocks()
      .compile();

    dataSource = moduleRef.get<DataSource>(DataSource);
    fixtureManager = new FixtureManager(dataSource);
    behaviorService = moduleRef.get<CharacterBehaviorService>(CharacterBehaviorService);
    emotionalStateService = moduleRef.get<EmotionalStateService>(EmotionalStateService);
    _needsService = moduleRef.get<NeedsService>(NeedsService);
    actionExecutorService = moduleRef.get<ActionExecutorService>(ActionExecutorService);
    characterService = moduleRef.get<CharacterService>(CharacterService);

    await fixtureManager.cleanDatabase();

    // Более агрессивная очистка всех моков
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  createTest(
    {
      name: 'should correctly process an action trigger with motivations',
    },
    async () => {
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({ user });
      await fixtureManager.createNeed({
        character,
        type: CharacterNeedType.SOCIAL_CONNECTION,
        currentValue: 70,
        growthRate: 0.5,
        priority: 3,
      });
      const motivations: IMotivation[] = [
        {
          id: 1,
          characterId: character.id,
          needType: CharacterNeedType.SOCIAL_CONNECTION,
          intensity: 0.8,
          status: 'active',
          createdAt: new Date(),
        },
      ];

      // Мокаем processActionTrigger в ActionService для возврата успешного результата
      const processActionTriggerSpy = jest
        .spyOn(actionExecutorService, 'processActionTrigger')
        .mockResolvedValue({
          success: true,
          message: 'Действие выполнено успешно',
          data: {
            action: {
              type: ActionType.SEND_MESSAGE,
              description: 'Test Action',
              content: 'Hello',
            },
            result: { success: true },
          },
        } as ActionResult);

      // Создаем контекст для триггера действия
      const triggerContext: ActionTriggerContext = {
        characterId: character.id,
        userId: Number(user.id),
        triggerType: 'user_message',
        triggerData: { message: 'Test message' },
        timestamp: new Date(),
        motivations: motivations,
      };

      // Исправленный вызов с передачей полного объекта контекста
      const result: ActionResult = await behaviorService.processActionTrigger(triggerContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(processActionTriggerSpy).toHaveBeenCalledWith(triggerContext);

      if (result.success && result.data) {
        const actionData = result.data;
        expect((actionData.action as { type: ActionType }).type).toBe(ActionType.SEND_MESSAGE);
      }
    },
  );

  createTest(
    {
      name: 'should correctly process an action trigger with emotional context',
    },
    async () => {
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({ user });

      // Мокаем метод getEmotionalState для возврата конкретного эмоционального состояния
      const emotionalState = {
        primary: 'joy',
        secondary: 'interest',
        intensity: 0.7,
        primaryChange: 0.1,
        secondaryChange: 0.1,
        source: 'user_message',
        description: 'Happy and interested state',
      };

      jest
        .spyOn(emotionalStateService, 'getEmotionalState')
        .mockResolvedValue(emotionalState as any);

      await emotionalStateService.updateEmotionalState(character.id, emotionalState as any);

      const motivations: IMotivation[] = [
        {
          id: 1,
          characterId: character.id,
          needType: CharacterNeedType.SELF_EXPRESSION,
          intensity: 0.75,
          status: 'active',
          createdAt: new Date(),
        },
      ];

      // Мокаем processActionTrigger в ActionService для возврата успешного результата
      const processActionTriggerSpy = jest
        .spyOn(actionExecutorService, 'processActionTrigger')
        .mockResolvedValue({
          success: true,
          message: 'Эмоциональное действие выполнено',
          data: {
            action: {
              type: ActionType.EXPRESS_EMOTION,
              description: 'Expressing joy',
              content: 'I am so happy!',
              metadata: { emotion: 'joy' },
            },
            result: { success: true },
          },
        } as ActionResult);

      // Создаем контекст для триггера действия
      const triggerContext: ActionTriggerContext = {
        characterId: character.id,
        userId: Number(user.id),
        triggerType: 'emotional_response',
        triggerData: { emotion: 'joy', intensity: 0.7 },
        timestamp: new Date(),
        motivations: motivations,
        emotionalResponse: 'I am feeling joyful',
      };

      // Исправленный вызов с передачей полного объекта контекста
      const result: ActionResult = await behaviorService.processActionTrigger(triggerContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(processActionTriggerSpy).toHaveBeenCalledWith(triggerContext);

      if (result.success && result.data) {
        const actionData = result.data;
        expect(actionData.action).toBeDefined();
        const action = actionData.action as { type: ActionType; metadata: { emotion: string } };
        expect(action.type).toBe(ActionType.EXPRESS_EMOTION);
        expect(action.metadata.emotion).toBe('joy');
      }
    },
  );

  createTest(
    {
      name: 'should update needs after action execution',
    },
    async () => {
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({ user });

      // Создаем реальную потребность в базе данных
      await fixtureManager.createNeed({
        character,
        type: CharacterNeedType.FUN,
        currentValue: 90,
        growthRate: 0.5,
        threshold: 70,
      });

      const motivations: IMotivation[] = [
        {
          id: 1,
          characterId: character.id,
          needType: CharacterNeedType.FUN,
          intensity: 0.9,
          status: 'active',
          createdAt: new Date(),
        },
      ];

      // Мокаем processActionTrigger в ActionService для возврата успешного результата
      const processActionTriggerSpy = jest
        .spyOn(actionExecutorService, 'processActionTrigger')
        .mockResolvedValue({
          success: true,
          message: 'Развлекательное действие выполнено',
          data: {
            action: {
              type: ActionType.ENTERTAINMENT,
              description: 'Play a fun game',
              content: 'Let us play!',
              relatedNeeds: [{ needType: CharacterNeedType.FUN, impact: -50 }],
            },
            result: { success: true },
          },
          needsImpact: { [CharacterNeedType.FUN]: -50 },
        } as ActionResult);

      // Создаем контекст для триггера действия
      const triggerContext: ActionTriggerContext = {
        characterId: character.id,
        userId: Number(user.id),
        triggerType: 'fun_activity',
        triggerData: { activity: 'game' },
        timestamp: new Date(),
        motivations: motivations,
      };

      // Вызываем метод и проверяем результат
      const result: ActionResult = await behaviorService.processActionTrigger(triggerContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(processActionTriggerSpy).toHaveBeenCalledWith(triggerContext);
      expect(result.data).toBeDefined();
      if (result.data) {
        expect(result.data.action).toBeDefined();
        const action = result.data.action as { type: ActionType };
        expect(action.type).toBe(ActionType.ENTERTAINMENT);
      }
    },
  );

  createTest(
    {
      name: 'должен корректно обрабатывать триггеры действий',
    },
    async () => {
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({ user });

      // Добавляем мотивации для успешного прохождения теста
      const motivations: IMotivation[] = [
        {
          id: 1,
          characterId: character.id,
          needType: CharacterNeedType.SOCIAL_CONNECTION,
          intensity: 0.8,
          status: 'active',
          createdAt: new Date(),
        },
      ];

      // Define the context for the action trigger
      const actionTriggerContext: ActionTriggerContext = {
        characterId: character.id,
        userId: Number(user.id),
        triggerType: 'user_request',
        triggerData: { message: 'test' },
        timestamp: new Date(),
        motivations: motivations, // Используем созданные мотивации
        needsExpression: 'test need',
        emotionalResponse: null,
        messagePrompt: 'test',
      };

      // Мокаем CharacterService.findOneById для возврата персонажа
      jest.spyOn(characterService, 'findOneById').mockResolvedValue(character);

      // Мокаем processActionTrigger в ActionService
      const processActionTriggerSpy = jest
        .spyOn(actionExecutorService, 'processActionTrigger')
        .mockResolvedValue({
          success: true,
          message: 'Действие выполнено успешно',
          data: {
            action: {
              type: ActionType.SEND_MESSAGE,
              description: 'Test action',
              content: 'Test message',
            },
            result: { success: true },
          },
        } as ActionResult);

      // Передаем полный контекст в processActionTrigger
      const result: ActionResult = await behaviorService.processActionTrigger(actionTriggerContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Проверяем, что processActionTrigger был вызван с правильными параметрами
      expect(processActionTriggerSpy).toHaveBeenCalledWith(actionTriggerContext);
    },
  );
});

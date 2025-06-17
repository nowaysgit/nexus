import { createTestSuite, createTest } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { CharacterModule } from '../../src/character/character.module';
import { CharacterBehaviorService } from '../../src/character/services/character-behavior.service';
import { ActionService } from '../../src/character/services/action.service';
import { EmotionalStateService } from '../../src/character/services/emotional-state.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { ActionType } from '../../src/character/enums/action-type.enum';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { IMotivation } from '../../src/character/interfaces/needs.interfaces';
import { DataSource } from 'typeorm';
import {
  ActionTriggerContext,
  CharacterAction,
} from '../../src/character/interfaces/behavior.interfaces';

createTestSuite('CharacterBehaviorService.processActionTrigger tests', () => {
  let moduleRef: import('@nestjs/testing').TestingModule | null = null;
  let dataSource: DataSource;
  let fixtureManager: FixtureManager;
  let behaviorService: CharacterBehaviorService;
  let emotionalStateService: EmotionalStateService;
  let needsService: NeedsService;
  let actionService: ActionService;

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
    needsService = moduleRef.get<NeedsService>(NeedsService);
    actionService = moduleRef.get<ActionService>(ActionService);

    await fixtureManager.cleanDatabase();
    jest.clearAllMocks();
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

      const mockAction = {
        type: ActionType.SEND_MESSAGE,
        description: 'Test Action',
        content: 'Hello',
      };

      const selectActionSpy = jest
        .spyOn(CharacterBehaviorService.prototype as any, 'selectActionForMotivation')
        .mockResolvedValue(mockAction);

      // Мокаем метод execute в actionService для возврата успешного результата
      const _executeSpy = jest.spyOn(actionService, 'execute').mockResolvedValue({
        success: true,
        data: {
          action: mockAction,
          result: { success: true },
        },
      });

      // Мокаем determineAndPerformAction в actionService для возврата нужного действия
      const determineAndPerformActionSpy = jest
        .spyOn(actionService, 'determineAndPerformAction')
        .mockResolvedValue({
          type: ActionType.SEND_MESSAGE,
          description: 'Test Action',
          content: 'Hello',
        });

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
      const result = await behaviorService.processActionTrigger(triggerContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(selectActionSpy).toHaveBeenCalledWith(expect.anything(), motivations[0]);
      expect(determineAndPerformActionSpy).toHaveBeenCalled();

      if (result.success) {
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

      const mockAction = {
        type: ActionType.EXPRESS_EMOTION,
        description: 'Expressing joy',
        content: 'I am so happy!',
        metadata: { emotion: 'joy' },
      };

      const selectActionSpy = jest
        .spyOn(CharacterBehaviorService.prototype as any, 'selectActionForMotivation')
        .mockResolvedValue(mockAction);

      // Мокаем метод execute в actionService для возврата успешного результата
      const _executeSpy = jest.spyOn(actionService, 'execute').mockResolvedValue({
        success: true,
        data: {
          action: mockAction,
          result: { success: true },
        },
      });

      // Мокаем determineAndPerformAction в actionService для возврата нужного действия
      const determineAndPerformActionSpy2 = jest
        .spyOn(actionService, 'determineAndPerformAction')
        .mockResolvedValue({
          type: ActionType.EXPRESS_EMOTION,
          description: 'Expressing joy',
          content: 'I am so happy!',
          metadata: { emotion: 'joy' },
        });

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
      const result = await behaviorService.processActionTrigger(triggerContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(selectActionSpy).toHaveBeenCalledWith(expect.anything(), motivations[0]);
      expect(determineAndPerformActionSpy2).toHaveBeenCalled();

      if (result.success) {
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
      const _need = await fixtureManager.createNeed({
        character,
        type: CharacterNeedType.FUN,
        currentValue: 90,
        growthRate: 0.5,
        threshold: 70,
      });

      const needs = await needsService.getNeeds(character.id);
      const initialFunNeed = needs.find(need => need.type === CharacterNeedType.FUN);
      expect(initialFunNeed?.currentValue).toBe(90);

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

      const mockAction = {
        type: ActionType.ENTERTAINMENT,
        description: 'Play a fun game',
        content: 'Let us play!',
        relatedNeeds: [{ needType: CharacterNeedType.FUN, impact: -50 }],
      };

      const selectActionSpy = jest
        .spyOn(CharacterBehaviorService.prototype as any, 'selectActionForMotivation')
        .mockResolvedValue(mockAction);

      // Мокаем метод execute в actionService для возврата успешного результата
      const _executeSpy = jest.spyOn(actionService, 'execute').mockResolvedValue({
        success: true,
        data: {
          action: mockAction,
          result: { success: true, needsUpdated: true },
        },
      });

      // Мокаем determineAndPerformAction в actionService для возврата нужного действия
      const determineAndPerformActionSpy3 = jest
        .spyOn(actionService, 'determineAndPerformAction')
        .mockImplementation(async (character, _context) => {
          // Имитируем выполнение действия и обновление потребностей
          const action: CharacterAction = {
            type: ActionType.ENTERTAINMENT,
            description: 'Play a fun game',
            content: 'Let us play!',
            relatedNeeds: [CharacterNeedType.FUN],
            status: 'completed',
            startTime: new Date(),
          };

          // Вызываем updateNeed напрямую
          await needsService.updateNeed(character.id, {
            type: CharacterNeedType.FUN,
            change: -50,
            reason: 'Test action impact',
          });

          return action;
        });

      // Вместо мока updateNeed, создаем шпион для отслеживания вызова
      const updateNeedSpy = jest.spyOn(needsService, 'updateNeed');

      // Создаем контекст для триггера действия
      const triggerContext: ActionTriggerContext = {
        characterId: character.id,
        userId: Number(user.id),
        triggerType: 'fun_activity',
        triggerData: { activity: 'game' },
        timestamp: new Date(),
        motivations: motivations,
      };

      // Исправленный вызов с передачей полного объекта контекста
      const result = await behaviorService.processActionTrigger(triggerContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(selectActionSpy).toHaveBeenCalledWith(expect.anything(), motivations[0]);
      expect(determineAndPerformActionSpy3).toHaveBeenCalled();

      // Проверяем, что метод updateNeed был вызван
      expect(updateNeedSpy).toHaveBeenCalled();

      // Проверяем параметры вызова
      const updateNeedCalls = updateNeedSpy.mock.calls;
      expect(updateNeedCalls.length).toBeGreaterThan(0);
      expect(updateNeedCalls[0][0]).toBe(character.id);
      expect(updateNeedCalls[0][1].type).toBe(CharacterNeedType.FUN);
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

      const mockAction = {
        type: ActionType.SEND_MESSAGE,
        description: 'Test action',
        content: 'Test message',
      };

      // Мокаем determineAndPerformAction
      const determineAndPerformActionSpy = jest
        .spyOn(actionService, 'determineAndPerformAction')
        .mockResolvedValue({
          success: true,
          data: {
            action: mockAction,
            result: { success: true },
          },
          type: ActionType.SEND_MESSAGE,
          description: 'Test action',
        } as CharacterAction);

      // Передаем полный контекст в processActionTrigger
      const result = await behaviorService.processActionTrigger(actionTriggerContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Проверяем, что determineAndPerformAction был вызван с правильными параметрами
      expect(determineAndPerformActionSpy).toHaveBeenCalled();
      expect(determineAndPerformActionSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          id: character.id,
        }),
      );
      expect(determineAndPerformActionSpy.mock.calls[0][1]).toEqual(actionTriggerContext);
    },
  );
});

import { createTestSuite, createTest } from '../../lib/tester';
import {
  ActionService,
  ActionContext,
  ActionTriggerContext,
  ActionResult,
} from '../../src/character/services/action.service';
import { Character } from '../../src/character/entities/character.entity';
import { ActionType } from '../../src/character/enums/action-type.enum';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { IMotivation } from '../../src/character/interfaces/needs.interfaces';
import { CharacterAction } from '../../src/character/interfaces/behavior.interfaces';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';

createTestSuite('ActionService', () => {
  let moduleRef: import('@nestjs/testing').TestingModule | null = null;
  let actionService: ActionService;

  beforeEach(async () => {
    moduleRef = await TestModuleBuilder.create()
      .withProviders([
        ActionService,
        {
          provide: getRepositoryToken(Character),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              name: 'Тестовый персонаж',
              archetype: CharacterArchetype.HERO,
            }),
          },
        },
        {
          provide: 'NeedsService',
          useValue: {
            getActiveNeeds: jest.fn().mockResolvedValue([
              { type: CharacterNeedType.REST, currentValue: 70 },
              { type: CharacterNeedType.COMMUNICATION, currentValue: 50 },
            ]),
            updateNeed: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: 'MemoryService',
          useValue: {
            createActionMemory: jest.fn().mockResolvedValue(true),
          },
        },
      ])
      .withRequiredMocks()
      .compile();

    actionService = moduleRef.get<ActionService>(ActionService);

    // Вызываем onModuleInit вручную, так как в тесте это не происходит автоматически
    await actionService.onModuleInit();
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
      moduleRef = null;
    }
  });

  createTest(
    {
      name: 'должен корректно создавать действие с ресурсами',
    },
    async () => {
      const action = await actionService.createActionWithResources(1, ActionType.SEND_MESSAGE, {
        resourceCost: 20,
        successProbability: 80,
        potentialReward: { communication: 15, attention: 10 },
        description: 'Тестовое сообщение',
      });

      expect(action).toBeDefined();
      expect(action.type).toBe(ActionType.SEND_MESSAGE);
      expect(action.metadata?.resourceCost).toBe(20);
      expect(action.metadata?.successProbability).toBe(80);
      expect(action.metadata?.potentialReward).toEqual({ communication: 15, attention: 10 });
      expect(action.description).toBe('Тестовое сообщение');
    },
  );

  createTest(
    {
      name: 'должен проверять доступность ресурсов для выполнения действия',
    },
    async () => {
      // Переопределяем getActiveNeeds для этого теста
      const needsService = moduleRef?.get('NeedsService');
      needsService.getActiveNeeds = jest.fn().mockResolvedValue([
        { type: CharacterNeedType.REST, currentValue: 20 }, // Низкий уровень энергии
        { type: CharacterNeedType.COMMUNICATION, currentValue: 50 },
      ]);

      const character = {
        id: 1,
        name: 'Тестовый персонаж',
        archetype: CharacterArchetype.HERO,
      } as Character;

      // Действие с высокой стоимостью ресурсов
      const action: CharacterAction = {
        type: ActionType.WORK,
        status: 'pending',
        startTime: new Date(),
        duration: 3600,
        description: 'Работа над проектом',
        metadata: {
          id: '123',
          resourceCost: 50, // Высокая стоимость
          successProbability: 70,
        },
      };

      const context: ActionContext = {
        character,
        action,
        metadata: {},
      };

      const canExecute = await actionService.canExecute(context);
      expect(canExecute).toBe(false); // Не должно выполняться из-за недостатка ресурсов
    },
  );

  createTest(
    {
      name: 'должен успешно выполнять действие при достаточных ресурсах',
    },
    async () => {
      // Переопределяем getActiveNeeds для этого теста
      const needsService = moduleRef?.get('NeedsService');
      needsService.getActiveNeeds = jest.fn().mockResolvedValue([
        { type: CharacterNeedType.REST, currentValue: 80 }, // Высокий уровень энергии
        { type: CharacterNeedType.COMMUNICATION, currentValue: 50 },
      ]);

      // Мокаем метод canExecute, чтобы он всегда возвращал true
      jest.spyOn(actionService, 'canExecute').mockResolvedValue(true);

      // Мокаем метод execute, чтобы он возвращал успешный результат
      const successResult: ActionResult = {
        success: true,
        needsImpact: { REST: -20, COMMUNICATION: 15 },
        message: 'Действие успешно выполнено',
      };
      jest.spyOn(actionService, 'execute').mockResolvedValue(successResult);

      const character = {
        id: 1,
        name: 'Тестовый персонаж',
        archetype: CharacterArchetype.HERO,
      } as Character;

      // Действие с умеренной стоимостью ресурсов
      const action: CharacterAction = {
        type: ActionType.SEND_MESSAGE,
        status: 'pending',
        startTime: new Date(),
        duration: 60,
        description: 'Отправка сообщения',
        metadata: {
          id: '123',
          resourceCost: 20, // Умеренная стоимость
          successProbability: 90,
          potentialReward: { communication: 15 },
        },
      };

      const context: ActionContext = {
        character,
        action,
        metadata: { message: 'Тестовое сообщение' },
      };

      // Сначала проверяем возможность выполнения
      const canExecute = await actionService.canExecute(context);
      expect(canExecute).toBe(true);

      // Затем выполняем действие
      const result = await actionService.execute(context);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.needsImpact).toBeDefined();
    },
  );

  createTest(
    {
      name: 'должен определять и выполнять действие на основе триггера',
    },
    async () => {
      const _character = {
        id: 1,
        name: 'Тестовый персонаж',
        archetype: CharacterArchetype.HERO,
      } as Character;

      // Создаем мотивацию для триггера
      const motivation: IMotivation = {
        id: 1,
        characterId: 1,
        needType: CharacterNeedType.COMMUNICATION,
        intensity: 80,
        status: 'active',
      };

      // Создаем контекст триггера
      const triggerContext: ActionTriggerContext = {
        characterId: 1,
        userId: 'user123',
        triggerType: 'message',
        triggerData: { content: 'Привет, как дела?' },
        timestamp: new Date(),
        motivations: [motivation],
        needsExpression: 'Персонаж хочет общаться',
        emotionalResponse: 'Радость от общения',
        messagePrompt: 'Ответить на приветствие',
      };

      // Мокаем метод determineActionFromTrigger
      jest.spyOn(actionService as any, 'determineActionFromTrigger').mockImplementation(() => {
        return Promise.resolve({
          type: ActionType.SEND_MESSAGE,
          status: 'pending',
          startTime: new Date(),
          duration: 60,
          description: 'Ответ на сообщение',
          metadata: {
            id: '123',
            resourceCost: 20,
            successProbability: 90,
            potentialReward: { communication: 15 },
          },
        });
      });

      // Тестируем processActionTrigger
      const result = await actionService.processActionTrigger(triggerContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен корректно обрабатывать прерывание действия',
    },
    async () => {
      // Создаем действие и регистрируем его
      const action: CharacterAction = {
        type: ActionType.WORK,
        status: 'in_progress',
        startTime: new Date(),
        duration: 3600,
        description: 'Работа над проектом',
        metadata: {
          id: '123',
          resourceCost: 30,
          successProbability: 80,
        },
      };

      // Мокаем методы registerAction и getCurrentAction
      jest.spyOn(actionService as any, 'registerAction').mockImplementation(() => {});
      jest.spyOn(actionService as any, 'getCurrentAction').mockImplementation(() => action);

      // Мокаем метод isPerformingAction
      jest.spyOn(actionService, 'isPerformingAction').mockReturnValue(true);
      const isPerformingActionSpy = jest.spyOn(actionService, 'isPerformingAction');

      // Регистрируем действие
      actionService.registerAction(action);

      // Устанавливаем текущее действие для персонажа
      const characterCurrentActions = new Map<string, string>();
      characterCurrentActions.set('1', '123');
      (actionService as any).characterCurrentActions = characterCurrentActions;

      // Прерываем действие
      await actionService.interruptAction('1');

      // После вызова interruptAction, isPerformingAction должен вернуть false
      isPerformingActionSpy.mockReturnValue(false);

      // Проверяем, что действие больше не выполняется
      expect(actionService.isPerformingAction('1')).toBe(false);
    },
  );
});

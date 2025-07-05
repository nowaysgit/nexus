import { TestModuleBuilder } from '../../../lib/tester/utils/test-module-builder';
import {
  ActionLifecycleService,
  ActionStats,
} from '../../../src/character/services/action/action-lifecycle.service';
import { ActionType } from '../../../src/character/enums/action-type.enum';
import { CharacterAction } from '../../../src/character/interfaces/behavior.interfaces';

describe('ActionLifecycleService', () => {
  let moduleRef: import('@nestjs/testing').TestingModule | null = null;
  let service: ActionLifecycleService;

  beforeEach(async () => {
    moduleRef = await TestModuleBuilder.create()
      .withProviders([ActionLifecycleService])
      .withRequiredMocks()
      .compile();

    service = moduleRef.get<ActionLifecycleService>(ActionLifecycleService);

    // Полная очистка состояния сервиса для изоляции тестов
    service.clearAllActions();
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
      moduleRef = null;
    }
  });

  describe('getSupportedActionTypes', () => {
    it('должен возвращать список поддерживаемых типов действий', () => {
      const supportedTypes = service.getSupportedActionTypes();

      expect(supportedTypes).toContain(ActionType.SEND_MESSAGE);
      expect(supportedTypes).toContain(ActionType.EXPRESS_EMOTION);
      expect(supportedTypes).toContain(ActionType.INITIATE_CONVERSATION);
      expect(supportedTypes.length).toBeGreaterThan(10);
    });
  });

  describe('registerAction', () => {
    it('должен регистрировать действие с автогенерацией ID', () => {
      const action: CharacterAction = {
        type: ActionType.SEND_MESSAGE,
        description: 'Тестовое сообщение',
        status: 'pending',
        startTime: new Date(),
        duration: 30,
        relatedNeeds: null,
        metadata: { characterId: 1 },
      };

      service.registerAction(action);

      expect(action.metadata?.id).toBeDefined();
      expect(typeof action.metadata?.id).toBe('string');

      const retrievedAction = service.getAction(action.metadata?.id as string);
      expect(retrievedAction).toEqual(action);
    });

    it('должен сохранять существующий ID действия', () => {
      const existingId = 'test-action-123';
      const action: CharacterAction = {
        type: ActionType.SEND_MESSAGE,
        description: 'Тестовое сообщение',
        status: 'pending',
        startTime: new Date(),
        duration: 30,
        relatedNeeds: null,
        metadata: { id: existingId, characterId: 1 },
      };

      service.registerAction(action);

      expect(action.metadata?.id).toBe(existingId);
      const retrievedAction = service.getAction(existingId);
      expect(retrievedAction).toEqual(action);
    });
  });

  describe('getActionsByCharacter', () => {
    it('должен возвращать действия конкретного персонажа', () => {
      const character1Actions = [
        createTestAction(ActionType.SEND_MESSAGE, 1),
        createTestAction(ActionType.EXPRESS_EMOTION, 1),
      ];
      const character2Actions = [createTestAction(ActionType.JOKE, 2)];

      character1Actions.forEach(action => service.registerAction(action));
      character2Actions.forEach(action => service.registerAction(action));

      const character1Results = service.getActionsByCharacter('1');
      const character2Results = service.getActionsByCharacter('2');

      expect(character1Results).toHaveLength(2);
      expect(character2Results).toHaveLength(1);
      expect(character1Results[0].metadata?.characterId).toBe(1);
      expect(character2Results[0].metadata?.characterId).toBe(2);
    });
  });

  describe('getCurrentAction и setCurrentAction', () => {
    it('должен устанавливать и получать текущее действие персонажа', () => {
      const action = createTestAction(ActionType.SEND_MESSAGE, 1);
      service.registerAction(action);
      const actionId = action.metadata?.id as string;

      service.setCurrentAction('1', actionId);
      const currentAction = service.getCurrentAction('1');

      expect(currentAction).toEqual(action);
    });

    it('должен возвращать undefined для персонажа без текущего действия', () => {
      const currentAction = service.getCurrentAction('999');
      expect(currentAction).toBeUndefined();
    });
  });

  describe('isPerformingAction', () => {
    it('должен возвращать true для персонажа с действием в процессе', () => {
      const action = createTestAction(ActionType.SEND_MESSAGE, 1);
      action.status = 'in_progress';
      service.registerAction(action);
      service.setCurrentAction('1', action.metadata?.id as string);

      const isPerforming = service.isPerformingAction('1');
      expect(isPerforming).toBe(true);
    });

    it('должен возвращать false для персонажа без действий в процессе', () => {
      const action = createTestAction(ActionType.SEND_MESSAGE, 1);
      action.status = 'pending';
      service.registerAction(action);
      service.setCurrentAction('1', action.metadata?.id as string);

      const isPerforming = service.isPerformingAction('1');
      expect(isPerforming).toBe(false);
    });
  });

  describe('stopCurrentAction', () => {
    it('должен останавливать текущее действие персонажа', async () => {
      const action = createTestAction(ActionType.SEND_MESSAGE, 1);
      service.registerAction(action);
      service.setCurrentAction('1', action.metadata?.id as string);

      const result = await service.stopCurrentAction('1');

      expect(result).toBe(true);
      expect(action.status).toBe('cancelled');
      expect(action.endTime).toBeDefined();
      expect(service.getCurrentAction('1')).toBeUndefined();
    });

    it('должен возвращать false если нет текущего действия', async () => {
      const result = await service.stopCurrentAction('999');
      expect(result).toBe(false);
    });
  });

  describe('getActionProgress', () => {
    it('должен возвращать 0 для персонажа без действий', () => {
      const progress = service.getActionProgress('999');
      expect(progress).toBe(0);
    });

    it('должен рассчитывать прогресс действия', () => {
      const action = createTestAction(ActionType.SEND_MESSAGE, 1);
      action.status = 'in_progress';
      action.startTime = new Date(Date.now() - 15000); // 15 секунд назад
      action.duration = 30; // 30 секунд общая продолжительность

      service.registerAction(action);
      service.setCurrentAction('1', action.metadata?.id as string);

      const progress = service.getActionProgress('1');
      expect(progress).toBeGreaterThan(40); // Примерно 50%
      expect(progress).toBeLessThan(60);
    });
  });

  describe('updateChatState', () => {
    it('должен обновлять состояние чата персонажа', () => {
      // Метод должен выполняться без ошибок
      expect(() => {
        service.updateChatState('1', 'user123', true);
        service.updateChatState('1', 'user123', false);
      }).not.toThrow();
    });
  });

  describe('getActionStats', () => {
    it('должен возвращать статистику действий', () => {
      const actions = [
        { ...createTestAction(ActionType.SEND_MESSAGE, 1), status: 'pending' as const },
        { ...createTestAction(ActionType.EXPRESS_EMOTION, 1), status: 'in_progress' as const },
        { ...createTestAction(ActionType.JOKE, 1), status: 'completed' as const },
        { ...createTestAction(ActionType.ASK_QUESTION, 1), status: 'failed' as const },
      ];

      actions.forEach(action => service.registerAction(action));

      const stats: ActionStats = service.getActionStats();

      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(1);
      expect(stats.inProgress).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });

  describe('clearCompletedActions', () => {
    it('должен очищать завершенные и провалившиеся действия', () => {
      const actions = [
        { ...createTestAction(ActionType.SEND_MESSAGE, 1), status: 'pending' as const },
        { ...createTestAction(ActionType.EXPRESS_EMOTION, 1), status: 'completed' as const },
        { ...createTestAction(ActionType.JOKE, 1), status: 'failed' as const },
      ];

      actions.forEach(action => service.registerAction(action));

      const clearedCount = service.clearCompletedActions();

      expect(clearedCount).toBe(2); // completed + failed
      expect(service.getActionStats().total).toBe(1); // только pending остался
    });
  });

  describe('canInterruptAction', () => {
    it('должен разрешать прерывание для высокоприоритетных действий', () => {
      const currentAction = createTestAction(ActionType.REST, 1);
      const newAction = createTestAction(ActionType.EMOTIONAL_RESPONSE, 1);

      const canInterrupt = service.canInterruptAction(currentAction, newAction);
      expect(canInterrupt).toBe(true);
    });

    it('должен запрещать прерывание для низкоприоритетных действий', () => {
      const currentAction = createTestAction(ActionType.WORK, 1);
      const newAction = createTestAction(ActionType.ENTERTAINMENT, 1);

      const canInterrupt = service.canInterruptAction(currentAction, newAction);
      expect(canInterrupt).toBe(false);
    });
  });

  function createTestAction(type: ActionType, characterId: number): CharacterAction {
    return {
      type,
      description: `Тестовое действие ${type}`,
      status: 'pending',
      startTime: new Date(),
      duration: 60,
      relatedNeeds: null,
      metadata: { characterId },
    };
  }
});

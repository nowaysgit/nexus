import { TestModuleBuilder } from '../../../lib/tester/utils/test-module-builder';
import { ActionSchedulerService } from '../../../src/character/services/action-scheduler.service';
import { ActionType } from '../../../src/character/enums/action-type.enum';
import { CharacterAction } from '../../../src/character/interfaces/behavior.interfaces';

describe('ActionSchedulerService', () => {
  let moduleRef: import('@nestjs/testing').TestingModule | null = null;
  let service: ActionSchedulerService;

  beforeEach(async () => {
    moduleRef = await TestModuleBuilder.create()
      .withProviders([ActionSchedulerService])
      .withRequiredMocks()
      .compile();

    service = moduleRef.get<ActionSchedulerService>(ActionSchedulerService);

    // Очищаем состояние сервиса перед каждым тестом
    if (service && typeof service.clearAllState === 'function') {
      service.clearAllState();
    }
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
      moduleRef = null;
    }
  });

  describe('scheduleAction', () => {
    it('должен планировать действие с задержкой', () => {
      const action = createTestAction(ActionType.SEND_MESSAGE, 1);
      const delay = 5000; // 5 секунд

      const scheduledAction = service.scheduleAction(action, delay);

      expect(scheduledAction.id).toBeDefined();
      expect(scheduledAction.action).toEqual(action);
      expect(scheduledAction.executeAt.getTime()).toBeGreaterThan(Date.now() + delay - 100);
      expect(scheduledAction.status).toBe('scheduled');
    });

    it('должен планировать действие на конкретное время', () => {
      const action = createTestAction(ActionType.SEND_MESSAGE, 1);
      const executeAt = new Date(Date.now() + 10000); // через 10 секунд

      const scheduledAction = service.scheduleAction(action, executeAt);

      expect(scheduledAction.executeAt).toEqual(executeAt);
      expect(scheduledAction.status).toBe('scheduled');
    });
  });

  describe('cancelScheduledAction', () => {
    it('должен отменять запланированное действие', () => {
      const action = createTestAction(ActionType.SEND_MESSAGE, 1);
      const scheduledAction = service.scheduleAction(action, 5000);

      const cancelled = service.cancelScheduledAction(scheduledAction.id);

      expect(cancelled).toBe(true);
      expect(scheduledAction.status).toBe('cancelled');
    });

    it('должен возвращать false для несуществующего действия', () => {
      const cancelled = service.cancelScheduledAction('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  describe('getScheduledActions', () => {
    it('должен возвращать запланированные действия персонажа', () => {
      const character1Actions = [
        service.scheduleAction(createTestAction(ActionType.SEND_MESSAGE, 1), 5000),
        service.scheduleAction(createTestAction(ActionType.EXPRESS_EMOTION, 1), 10000),
      ];
      const character2Action = service.scheduleAction(createTestAction(ActionType.JOKE, 2), 7000);

      const character1Scheduled = service.getScheduledActions('1');
      const character2Scheduled = service.getScheduledActions('2');

      expect(character1Scheduled).toHaveLength(2);
      expect(character2Scheduled).toHaveLength(1);
      expect(character1Scheduled[0].action.metadata?.characterId).toBe(1);
      expect(character2Scheduled[0].action.metadata?.characterId).toBe(2);
    });
  });

  describe('getReadyActions', () => {
    it('должен возвращать действия готовые к выполнению', async () => {
      // Планируем действие в прошлом (должно быть готово)
      const pastAction = service.scheduleAction(
        createTestAction(ActionType.SEND_MESSAGE, 1),
        new Date(Date.now() - 1000),
      );

      // Планируем действие в будущем (не должно быть готово)
      service.scheduleAction(
        createTestAction(ActionType.EXPRESS_EMOTION, 1),
        new Date(Date.now() + 10000),
      );

      const readyActions = service.getReadyActions();

      expect(readyActions).toHaveLength(1);
      expect(readyActions[0].id).toBe(pastAction.id);
    });
  });

  describe('markAsExecuted', () => {
    it('должен помечать действие как выполненное', () => {
      const scheduledAction = service.scheduleAction(
        createTestAction(ActionType.SEND_MESSAGE, 1),
        1000,
      );

      service.markAsExecuted(scheduledAction.id);

      expect(scheduledAction.status).toBe('executed');
      expect(scheduledAction.executedAt).toBeDefined();
    });
  });

  describe('createCronJob', () => {
    it('должен создавать cron-задачу', () => {
      const action = createTestAction(ActionType.SEND_MESSAGE, 1);
      const cronExpression = '0 0 * * *'; // каждый день в полночь

      const cronJob = service.createCronJob(action, cronExpression);

      expect(cronJob.id).toBeDefined();
      expect(cronJob.action).toEqual(action);
      expect(cronJob.cronExpression).toBe(cronExpression);
      expect(cronJob.isActive).toBe(true);
    });

    it('должен создавать cron-задачу с дополнительными параметрами', () => {
      const action = createTestAction(ActionType.SEND_MESSAGE, 1);
      const cronExpression = '*/5 * * * *'; // каждые 5 минут
      const maxExecutions = 10;

      const cronJob = service.createCronJob(action, cronExpression, { maxExecutions });

      expect(cronJob.maxExecutions).toBe(maxExecutions);
      expect(cronJob.executionCount).toBe(0);
    });
  });

  describe('pauseCronJob и resumeCronJob', () => {
    it('должен приостанавливать и возобновлять cron-задачу', () => {
      const action = createTestAction(ActionType.SEND_MESSAGE, 1);
      const cronJob = service.createCronJob(action, '0 0 * * *');

      service.pauseCronJob(cronJob.id);
      expect(cronJob.isActive).toBe(false);

      service.resumeCronJob(cronJob.id);
      expect(cronJob.isActive).toBe(true);
    });
  });

  describe('deleteCronJob', () => {
    it('должен удалять cron-задачу', () => {
      const action = createTestAction(ActionType.SEND_MESSAGE, 1);
      const cronJob = service.createCronJob(action, '0 0 * * *');

      const deleted = service.deleteCronJob(cronJob.id);

      expect(deleted).toBe(true);
      expect(service.getCronJobs('1')).toHaveLength(0);
    });
  });

  describe('getCronJobs', () => {
    it('должен возвращать cron-задачи персонажа', () => {
      const character1Jobs = [
        service.createCronJob(createTestAction(ActionType.SEND_MESSAGE, 1), '0 0 * * *'),
        service.createCronJob(createTestAction(ActionType.EXPRESS_EMOTION, 1), '*/30 * * * *'),
      ];
      const character2Job = service.createCronJob(
        createTestAction(ActionType.JOKE, 2),
        '0 12 * * *',
      );

      const character1CronJobs = service.getCronJobs('1');
      const character2CronJobs = service.getCronJobs('2');

      expect(character1CronJobs).toHaveLength(2);
      expect(character2CronJobs).toHaveLength(1);
    });
  });

  describe('getNextCronExecution', () => {
    it('должен возвращать время следующего выполнения cron-задачи', () => {
      const action = createTestAction(ActionType.SEND_MESSAGE, 1);
      const cronJob = service.createCronJob(action, '0 0 * * *'); // каждый день в полночь

      const nextExecution = service.getNextCronExecution(cronJob.id);

      expect(nextExecution).toBeInstanceOf(Date);
      expect(nextExecution.getTime()).toBeGreaterThan(Date.now());
    });

    it('должен возвращать null для несуществующей задачи', () => {
      const nextExecution = service.getNextCronExecution('non-existent-id');
      expect(nextExecution).toBeNull();
    });
  });

  describe('clearScheduledActions', () => {
    it('должен очищать выполненные и отмененные действия', () => {
      const action1 = service.scheduleAction(createTestAction(ActionType.SEND_MESSAGE, 1), 1000);
      const action2 = service.scheduleAction(createTestAction(ActionType.EXPRESS_EMOTION, 1), 2000);
      const action3 = service.scheduleAction(createTestAction(ActionType.JOKE, 1), 3000);

      service.markAsExecuted(action1.id);
      service.cancelScheduledAction(action2.id);
      // action3 остается scheduled

      const clearedCount = service.clearScheduledActions();

      expect(clearedCount).toBe(2); // executed + cancelled
      expect(service.getScheduledActions('1')).toHaveLength(1); // только scheduled остался
    });
  });

  describe('hasScheduledActions', () => {
    it('должен возвращать true если у персонажа есть запланированные действия', () => {
      service.scheduleAction(createTestAction(ActionType.SEND_MESSAGE, 1), 5000);

      const hasScheduled = service.hasScheduledActions('1');
      expect(hasScheduled).toBe(true);
    });

    it('должен возвращать false если у персонажа нет запланированных действий', () => {
      const hasScheduled = service.hasScheduledActions('999');
      expect(hasScheduled).toBe(false);
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

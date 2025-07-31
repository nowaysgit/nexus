import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
import { ActionExecutorService } from '../../../src/character/services/action/action-executor.service';
import { ActionLifecycleService } from '../../../src/character/services/action/action-lifecycle.service';
import { ActionSchedulerService } from '../../../src/character/services/action/action-scheduler.service';
import { ActionResourceService } from '../../../src/character/services/action/action-resource.service';
import { ActionGeneratorService } from '../../../src/character/services/action/action-generator.service';
import {
  Character,
  CharacterGender,
  RelationshipStage,
} from '../../../src/character/entities/character.entity';
import { LogService } from '../../../src/logging/log.service';
import { NeedsService } from '../../../src/character/services/core/needs.service';
import { MemoryService } from '../../../src/character/services/core/memory.service';
import { ActionType } from '../../../src/character/enums/action-type.enum';
import { CharacterNeedType } from '../../../src/character/enums/character-need-type.enum';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';
import {
  CharacterAction,
  ActionResult,
  ActionTriggerContext,
} from '../../../src/character/interfaces/behavior.interfaces';
import { ActionContext } from '../../../src/character/services/action/action-lifecycle.service';

describe('ActionExecutorService', () => {
  let service: ActionExecutorService;
  let moduleRef: jest.Mocked<ModuleRef>;
  let repository: jest.Mocked<Repository<Character>>;
  let lifecycleService: jest.Mocked<ActionLifecycleService>;
  let schedulerService: jest.Mocked<ActionSchedulerService>;
  let resourceService: jest.Mocked<ActionResourceService>;
  let generatorService: jest.Mocked<ActionGeneratorService>;
  let logService: jest.Mocked<LogService>;
  let needsService: jest.Mocked<NeedsService>;
  let memoryService: jest.Mocked<MemoryService>;

  const mockCharacter: Character = {
    id: 1,
    name: 'Test Character',
    fullName: 'Test Character Full',
    age: 25,
    gender: CharacterGender.FEMALE,
    biography: 'Test description',
    appearance: 'Test appearance',
    personality: {
      traits: ['friendly', 'helpful'],
      hobbies: ['reading', 'helping'],
      fears: ['loneliness'],
      values: ['kindness', 'honesty'],
      musicTaste: ['pop'],
      strengths: ['empathy'],
      weaknesses: ['sensitivity'],
    },
    psychologicalProfile: null,
    preferences: null,
    idealPartner: null,
    knowledgeAreas: ['general'],
    archetype: CharacterArchetype.COMPANION,
    affection: 50,
    trust: 60,
    energy: 80,
    relationshipStage: RelationshipStage.FRIENDSHIP,
    developmentStage: 'basic',
    isActive: true,
    isArchived: false,
    user: null,
    userId: null,
    needs: [],
    dialogs: [],
    memories: [],
    actions: [],
    motivations: [],
    storyProgress: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastInteraction: new Date(),
  } as Character;

  const mockAction: CharacterAction = {
    id: 'action-1',
    type: ActionType.SEND_MESSAGE,
    description: 'Test action',
    status: 'planned',
    metadata: { id: 'action-1', prompt: 'Hello' },
  };

  const _mockContext: ActionTriggerContext = {
    characterId: 1,
    userId: 'user-1',
    triggerType: 'test',
    timestamp: new Date(),
  };

  const mockActionContext: ActionContext = {
    character: mockCharacter,
    action: mockAction,
    metadata: { characterId: 1 },
  };

  beforeEach(async () => {
    const mockRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockLifecycleService = {
      getSupportedActionTypes: jest.fn(),
      registerAction: jest.fn(),
      setCurrentAction: jest.fn(),
      getCurrentAction: jest.fn(),
      getAction: jest.fn(),
      getActionsByCharacter: jest.fn(),
      isPerformingAction: jest.fn(),
      getActionProgress: jest.fn(),
      completeAction: jest.fn(),
      interruptAction: jest.fn(),
      updateChatState: jest.fn(),
      getActionStats: jest.fn(),
      clearCompletedActions: jest.fn(),
    };

    const mockSchedulerService = {
      scheduleAction: jest.fn(),
      cancelScheduledAction: jest.fn(),
      getScheduledActions: jest.fn(),
      getScheduledActionsAsTimers: jest.fn(),
    };

    const mockResourceService = {
      checkResourceAvailability: jest.fn(),
      executeActionWithResources: jest.fn(),
      createActionWithResources: jest.fn(),
    };

    const mockGeneratorService = {
      generateCommunicationAction: jest.fn(),
      generateEmotionalAction: jest.fn(),
      determineAndPerformAction: jest.fn(),
    };

    const mockLogService = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const mockNeedsService = {
      getActiveNeeds: jest.fn(),
      updateNeedValue: jest.fn(),
      updateNeed: jest.fn(),
      getNeedsByCharacter: jest.fn(),
      processNeedsGrowth: jest.fn(),
      resetNeed: jest.fn(),
      createNeed: jest.fn(),
      deleteNeed: jest.fn(),
      activateNeed: jest.fn(),
      deactivateNeed: jest.fn(),
      getNeed: jest.fn(),
      getAllNeeds: jest.fn(),
      getCharacterNeedsSummary: jest.fn(),
      processNeedDecay: jest.fn(),
      processNeedsFulfillment: jest.fn(),
      getBlockedNeeds: jest.fn(),
      calculateNeedPriority: jest.fn(),
      processNeedsImpact: jest.fn(),
    };

    const mockMemoryService = {
      addMemory: jest.fn(),
      getMemories: jest.fn(),
      createMemory: jest.fn(),
      createActionMemory: jest.fn(),
      createEventMemory: jest.fn(),
      createMessageMemory: jest.fn(),
      updateMemory: jest.fn(),
      deleteMemory: jest.fn(),
      getMemory: jest.fn(),
      getMemoriesByType: jest.fn(),
      getMemoriesByImportance: jest.fn(),
      findRelevantMemories: jest.fn(),
    };

    const mockModuleRef = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionExecutorService,
        {
          provide: ModuleRef,
          useValue: mockModuleRef,
        },
        {
          provide: getRepositoryToken(Character),
          useValue: mockRepository,
        },
        {
          provide: ActionLifecycleService,
          useValue: mockLifecycleService,
        },
        {
          provide: ActionSchedulerService,
          useValue: mockSchedulerService,
        },
        {
          provide: ActionResourceService,
          useValue: mockResourceService,
        },
        {
          provide: ActionGeneratorService,
          useValue: mockGeneratorService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    }).compile();

    service = module.get<ActionExecutorService>(ActionExecutorService);
    moduleRef = module.get(ModuleRef);
    repository = module.get(getRepositoryToken(Character));
    lifecycleService = module.get(ActionLifecycleService);
    schedulerService = module.get(ActionSchedulerService);
    resourceService = module.get(ActionResourceService);
    generatorService = module.get(ActionGeneratorService);
    logService = module.get(LogService);

    needsService = mockNeedsService as unknown as jest.Mocked<NeedsService>;
    memoryService = mockMemoryService as unknown as jest.Mocked<MemoryService>;

    // Настройка ModuleRef для возврата mock сервисов
    moduleRef.get.mockImplementation((token: string) => {
      if (token === 'NeedsService') return needsService;
      if (token === 'MemoryService') return memoryService;
      return undefined;
    });
  });

  describe('onModuleInit', () => {
    it('должен успешно инициализировать сервисы', async () => {
      await service.onModuleInit();

      expect(moduleRef.get).toHaveBeenCalledWith('NeedsService', { strict: false });
      expect(moduleRef.get).toHaveBeenCalledWith('MemoryService', { strict: false });
      expect(logService.info).toHaveBeenCalledWith(
        'ActionExecutorService успешно инициализирован',
        undefined,
      );
    });

    it('должен обработать ошибки при инициализации', async () => {
      moduleRef.get.mockImplementation(() => {
        throw new Error('Service not found');
      });

      await service.onModuleInit();

      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining('Не удалось инициализировать сервисы'),
        undefined,
      );
    });
  });

  describe('getSupportedActionTypes', () => {
    it('должен возвращать поддерживаемые типы действий', () => {
      const supportedTypes = [ActionType.SEND_MESSAGE, ActionType.EXPRESS_EMOTION];
      lifecycleService.getSupportedActionTypes.mockReturnValue(supportedTypes);

      const result = service.getSupportedActionTypes();

      expect(result).toEqual(supportedTypes);
      expect(lifecycleService.getSupportedActionTypes).toHaveBeenCalled();
    });
  });

  describe('canExecute', () => {
    beforeEach(() => {
      lifecycleService.getSupportedActionTypes.mockReturnValue([ActionType.SEND_MESSAGE]);
      resourceService.checkResourceAvailability.mockResolvedValue(true);
      lifecycleService.getCurrentAction.mockReturnValue(undefined);
    });

    it('должен разрешить выполнение поддерживаемого действия', async () => {
      needsService.getActiveNeeds.mockResolvedValue([
        {
          characterId: 1,
          type: CharacterNeedType.COMMUNICATION,
          currentValue: 50,
          maxValue: 100,
          growthRate: 1,
          decayRate: 0.1,
          threshold: 30,
          dynamicPriority: 1,
          lastUpdated: new Date(),
          isActive: true,
          priority: 1,
        },
      ]);

      const result = await service.canExecute(mockActionContext);

      expect(result).toBe(true);
      expect(lifecycleService.getSupportedActionTypes).toHaveBeenCalled();
      expect(resourceService.checkResourceAvailability).toHaveBeenCalledWith(mockActionContext);
    });

    it('должен запретить выполнение неподдерживаемого действия', async () => {
      lifecycleService.getSupportedActionTypes.mockReturnValue([ActionType.EXPRESS_EMOTION]);

      const result = await service.canExecute(mockActionContext);

      expect(result).toBe(false);
      expect(logService.debug).toHaveBeenCalledWith(
        expect.stringContaining('Тип действия SEND_MESSAGE не поддерживается'),
        undefined,
      );
    });

    it('должен запретить выполнение при недостатке ресурсов', async () => {
      resourceService.checkResourceAvailability.mockResolvedValue(false);

      const result = await service.canExecute(mockActionContext);

      expect(result).toBe(false);
      expect(logService.debug).toHaveBeenCalledWith(
        expect.stringContaining('Недостаточно ресурсов'),
        undefined,
      );
    });

    it('должен запретить выполнение при активном действии', async () => {
      const currentAction = { ...mockAction, status: 'in_progress' as const };
      lifecycleService.getCurrentAction.mockReturnValue(currentAction);
      lifecycleService.getAction.mockReturnValue(currentAction);

      const newActionContext: ActionContext = {
        character: mockCharacter,
        action: { ...mockAction, metadata: { id: 'action-2' } },
        metadata: { characterId: 1 },
      };

      const result = await service.canExecute(newActionContext);

      expect(result).toBe(false);
      expect(logService.debug).toHaveBeenCalledWith(
        expect.stringContaining('уже выполняет действие'),
        undefined,
      );
    });

    it('должен обработать ошибку и вернуть false', async () => {
      lifecycleService.getSupportedActionTypes.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await service.canExecute(mockActionContext);

      expect(result).toBe(false);
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining('Ошибка проверки canExecute'),
        undefined,
      );
    });
  });

  describe('execute', () => {
    const mockResult: ActionResult = {
      success: true,
      message: 'Action executed successfully',
      data: { response: 'Hello world' },
    };

    beforeEach(() => {
      jest.spyOn(service, 'canExecute').mockResolvedValue(true);
      resourceService.executeActionWithResources.mockResolvedValue(mockResult);
      lifecycleService.completeAction.mockResolvedValue();
    });

    it('должен успешно выполнить действие', async () => {
      const result = await service.execute(mockActionContext);

      expect(result).toEqual(mockResult);
      expect(service.canExecute).toHaveBeenCalledWith(mockActionContext);
      expect(lifecycleService.registerAction).toHaveBeenCalledWith(mockAction);
      expect(lifecycleService.setCurrentAction).toHaveBeenCalledWith('1', 'action-1');
      expect(resourceService.executeActionWithResources).toHaveBeenCalledWith(mockActionContext);
      expect(lifecycleService.completeAction).toHaveBeenCalledWith('1', true);
      expect(logService.info).toHaveBeenCalledWith(
        expect.stringContaining('Действие SEND_MESSAGE выполнено'),
        undefined,
      );
    });

    it('должен отклонить выполнение недоступного действия', async () => {
      jest.spyOn(service, 'canExecute').mockResolvedValue(false);

      const result = await service.execute(mockActionContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain('не может быть выполнено');
      expect(resourceService.executeActionWithResources).not.toHaveBeenCalled();
    });

    it('должен обработать ошибку при выполнении', async () => {
      resourceService.executeActionWithResources.mockRejectedValue(new Error('Execution error'));

      const result = await service.execute(mockActionContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Ошибка выполнения действия');
      expect(lifecycleService.completeAction).toHaveBeenCalledWith('1', false);
    });

    it('должен обновить статус действия во время выполнения', async () => {
      await service.execute(mockActionContext);

      expect(mockActionContext.action.status).toBe('in_progress');
      expect(mockActionContext.action.startTime).toBeInstanceOf(Date);
    });
  });

  describe('interrupt', () => {
    it('должен прервать действие', async () => {
      await service.interrupt(mockActionContext);

      expect(lifecycleService.interruptAction).toHaveBeenCalledWith('1');
      expect(mockActionContext.action.status).toBe('cancelled');
      expect(mockActionContext.action.endTime).toBeInstanceOf(Date);
    });

    it('должен обработать ошибку при прерывании', async () => {
      lifecycleService.interruptAction.mockRejectedValue(new Error('Interrupt error'));

      await expect(service.interrupt(mockActionContext)).rejects.toThrow();
    });
  });

  describe('generateCommunicationAction', () => {
    it('должен генерировать коммуникационное действие', async () => {
      const expectedAction = { ...mockAction, type: ActionType.SEND_MESSAGE };
      generatorService.generateCommunicationAction.mockResolvedValue(expectedAction);

      const result = await service.generateCommunicationAction(mockCharacter, 'Hello', 'user-1');

      expect(result).toEqual(expectedAction);
      expect(generatorService.generateCommunicationAction).toHaveBeenCalledWith(
        mockCharacter,
        'Hello',
        'user-1',
      );
    });
  });

  describe('generateEmotionalAction', () => {
    it('должен генерировать эмоциональное действие', async () => {
      const expectedAction = { ...mockAction, type: ActionType.EXPRESS_EMOTION };
      generatorService.generateEmotionalAction.mockResolvedValue(expectedAction);

      const result = await service.generateEmotionalAction(mockCharacter, 'happy', 0.8);

      expect(result).toEqual(expectedAction);
      expect(generatorService.generateEmotionalAction).toHaveBeenCalledWith(
        mockCharacter,
        'happy',
        0.8,
      );
    });
  });

  describe('действия с состоянием', () => {
    it('должен регистрировать действие', () => {
      service.registerAction(mockAction);

      expect(lifecycleService.registerAction).toHaveBeenCalledWith(mockAction);
    });

    it('должен получать действие по ID', () => {
      lifecycleService.getAction.mockReturnValue(mockAction);

      const result = service.getAction('action-1');

      expect(result).toEqual(mockAction);
      expect(lifecycleService.getAction).toHaveBeenCalledWith('action-1');
    });

    it('должен получать действия персонажа', () => {
      const actions = [mockAction];
      lifecycleService.getActionsByCharacter.mockReturnValue(actions);

      const result = service.getActionsByCharacter('1');

      expect(result).toEqual(actions);
      expect(lifecycleService.getActionsByCharacter).toHaveBeenCalledWith('1');
    });

    it('должен получать текущее действие', () => {
      lifecycleService.getCurrentAction.mockReturnValue(mockAction);

      const result = service.getCurrentAction('1');

      expect(result).toEqual(mockAction);
      expect(lifecycleService.getCurrentAction).toHaveBeenCalledWith('1');
    });

    it('должен проверять выполнение действия', () => {
      lifecycleService.isPerformingAction.mockReturnValue(true);

      const result = service.isPerformingAction('1');

      expect(result).toBe(true);
      expect(lifecycleService.isPerformingAction).toHaveBeenCalledWith('1');
    });

    it('должен получать прогресс действия', () => {
      lifecycleService.getActionProgress.mockReturnValue(0.5);

      const result = service.getActionProgress('1');

      expect(result).toBe(0.5);
      expect(lifecycleService.getActionProgress).toHaveBeenCalledWith('1');
    });
  });

  describe('планирование действий', () => {
    it('должен планировать действие', () => {
      const scheduledFor = new Date();
      service.scheduleAction(mockAction, scheduledFor);

      expect(schedulerService.scheduleAction).toHaveBeenCalledWith(mockAction, scheduledFor);
    });

    it('должен отменять запланированное действие', () => {
      schedulerService.cancelScheduledAction.mockReturnValue(true);

      const result = service.cancelScheduledAction('action-1');

      expect(result).toBe(true);
      expect(schedulerService.cancelScheduledAction).toHaveBeenCalledWith('action-1');
    });

    it('должен получать запланированные действия', () => {
      const scheduledActions = [
        {
          actionId: 'scheduled-1',
          scheduledFor: new Date(),
          callback: jest.fn(),
          isRecurring: false,
        },
      ];
      schedulerService.getScheduledActionsAsTimers.mockReturnValue(scheduledActions);

      const result = service.getScheduledActions();

      expect(result).toEqual(scheduledActions);
      expect(schedulerService.getScheduledActionsAsTimers).toHaveBeenCalled();
    });
  });

  describe('создание действий с ресурсами', () => {
    it('должен создавать действие с ресурсами', () => {
      const options = { resourceCost: 10, successProbability: 0.8 };
      const expectedAction = { ...mockAction, metadata: { ...mockAction.metadata, ...options } };
      resourceService.createActionWithResources.mockReturnValue(expectedAction);

      const result = service.createActionWithResources(1, ActionType.SEND_MESSAGE, options);

      expect(result).toEqual(expectedAction);
      expect(resourceService.createActionWithResources).toHaveBeenCalledWith(
        1,
        ActionType.SEND_MESSAGE,
        options,
      );
    });
  });

  describe('управление состоянием чата', () => {
    it('должен обновлять состояние чата', () => {
      service.updateChatState('1', 'user-1', true);

      expect(lifecycleService.updateChatState).toHaveBeenCalledWith('1', 'user-1', true);
    });
  });

  describe('статистика', () => {
    it('должен получать статистику действий', () => {
      const stats = {
        total: 10,
        pending: 1,
        inProgress: 1,
        completed: 8,
        failed: 2,
        cancelled: 0,
      };
      lifecycleService.getActionStats.mockReturnValue(stats);

      const result = service.getActionStats();

      expect(result).toEqual(stats);
      expect(lifecycleService.getActionStats).toHaveBeenCalled();
    });

    it('должен очищать завершенные действия', () => {
      lifecycleService.clearCompletedActions.mockReturnValue(5);

      const result = service.clearCompletedActions();

      expect(result).toBe(5);
      expect(lifecycleService.clearCompletedActions).toHaveBeenCalled();
    });
  });

  describe('остановка текущего действия', () => {
    it('должен останавливать текущее действие', async () => {
      lifecycleService.getCurrentAction.mockReturnValue(mockAction);
      repository.findOne.mockResolvedValue(mockCharacter);
      const interruptSpy = jest.spyOn(service, 'interrupt').mockResolvedValue();

      const result = await service.stopCurrentAction('1');

      expect(result).toBe(true);
      expect(interruptSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          character: expect.objectContaining({ id: 1 }) as unknown,
          action: mockAction,
        }) as unknown,
      );
    });

    it('должен вернуть false если нет текущего действия', async () => {
      lifecycleService.getCurrentAction.mockReturnValue(undefined);
      repository.findOne.mockResolvedValue(mockCharacter);

      const result = await service.stopCurrentAction('1');

      expect(result).toBe(false);
    });
  });
});

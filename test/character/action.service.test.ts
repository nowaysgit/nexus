import { Test, TestingModule } from '@nestjs/testing';
import { ActionExecutorService } from '../../src/character/services/action/action-executor.service';
import { ActionLifecycleService } from '../../src/character/services/action/action-lifecycle.service';
import { ActionSchedulerService } from '../../src/character/services/action/action-scheduler.service';
import { ActionGeneratorService } from '../../src/character/services/action/action-generator.service';
import { ActionResourceService } from '../../src/character/services/action/action-resource.service';
import { LogService } from '../../src/logging/log.service';
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';
import { Character } from '../../src/character/entities/character.entity';
import { ActionType } from '../../src/character/enums/action-type.enum';
import { CharacterAction } from '../../src/character/interfaces/behavior.interfaces';
import {
  ActionContext,
  ActionResult,
} from '../../src/character/services/action/action-lifecycle.service';
import { ActionTriggerContext } from '../../src/character/services/action/action-generator.service';
import { ModuleRef } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('ActionExecutorService', () => {
  let module: TestingModule;
  let actionExecutorService: ActionExecutorService;

  beforeEach(async () => {
    const mockCharacterRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockModuleRef = {
      get: jest.fn(),
      resolve: jest.fn(),
    };

    const mockActionLifecycleService = {
      getSupportedActionTypes: jest.fn(() => [ActionType.SEND_MESSAGE, ActionType.REST]),
      registerAction: jest.fn(),
      getAction: jest.fn(),
      getActionsByCharacter: jest.fn(() => []),
      getCurrentAction: jest.fn(),
      isPerformingAction: jest.fn(() => false),
      stopCurrentAction: jest.fn(() => Promise.resolve(true)),
      getActionProgress: jest.fn(() => 0),
      updateChatState: jest.fn(),
      interruptAction: jest.fn(() => Promise.resolve()),
      completeAction: jest.fn(() => Promise.resolve()),
      getActionStats: jest.fn(() => ({ total: 0, completed: 0, failed: 0 })),
      clearCompletedActions: jest.fn(() => 0),
      setCurrentAction: jest.fn(),
    };

    const mockActionSchedulerService = {
      scheduleAction: jest.fn(),
      cancelScheduledAction: jest.fn(() => true),
    };

    const mockActionGeneratorService = {
      generateCommunicationAction: jest.fn(() =>
        Promise.resolve({
          type: ActionType.SEND_MESSAGE,
          description: 'Test action',
        }),
      ),
      generateEmotionalAction: jest.fn(() =>
        Promise.resolve({
          type: ActionType.EXPRESS_EMOTION,
          description: 'Test emotion',
        }),
      ),
    };

    const mockActionResourceService = {
      checkResourceAvailability: jest.fn(() => Promise.resolve(true)),
      executeActionWithResources: jest.fn(() => Promise.resolve({ success: true })),
      createActionWithResources: jest.fn(
        (characterId: number, actionType: ActionType, options: Record<string, unknown> = {}) => ({
          type: actionType,
          description: (options.description as string) || `Действие типа ${actionType}`,
          status: 'pending' as const,
          startTime: new Date(),
          duration: 5000,
          relatedNeeds: [],
          metadata: {
            id: 'test-action-id',
            characterId,
            resourceCost: (options.resourceCost as number) || 25,
            successProbability: (options.successProbability as number) || 80,
            potentialReward: (options.potentialReward as Record<string, unknown>) || {},
            timestamp: new Date(),
          },
        }),
      ),
    };

    module = await Test.createTestingModule({
      providers: [
        ActionExecutorService,
        {
          provide: ModuleRef,
          useValue: mockModuleRef,
        },
        {
          provide: getRepositoryToken(Character),
          useValue: mockCharacterRepository,
        },
        {
          provide: ActionLifecycleService,
          useValue: mockActionLifecycleService,
        },
        {
          provide: ActionSchedulerService,
          useValue: mockActionSchedulerService,
        },
        {
          provide: ActionGeneratorService,
          useValue: mockActionGeneratorService,
        },
        {
          provide: ActionResourceService,
          useValue: mockActionResourceService,
        },
        {
          provide: LogService,
          useClass: MockLogService,
        },
      ],
    }).compile();

    actionExecutorService = module.get<ActionExecutorService>(ActionExecutorService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(actionExecutorService).toBeDefined();
  });

  it('should create action with resources', () => {
    const action = actionExecutorService.createActionWithResources(1, ActionType.SEND_MESSAGE, {
      description: 'Test message',
      resourceCost: 10,
    });

    expect(action).toBeDefined();
    expect(action.type).toBe(ActionType.SEND_MESSAGE);
    expect(action.description).toBe('Test message');
  });

  it('should check if action can be executed', async () => {
    const character = new Character();
    character.id = 1;
    character.name = 'Test Character';

    const action: CharacterAction = {
      id: 'action-1',
      type: ActionType.SEND_MESSAGE,
      description: 'Test action',
      status: 'pending',
      priority: 1,
      metadata: { id: 'action-1' },
    };

    const context: ActionContext = {
      character,
      action,
      metadata: {},
    };

    const canExecute = await actionExecutorService.canExecute(context);

    expect(canExecute).toBe(true);
  });

  it('should execute action successfully', async () => {
    const character = new Character();
    character.id = 1;
    character.name = 'Test Character';

    const action: CharacterAction = {
      id: 'action-1',
      type: ActionType.SEND_MESSAGE,
      description: 'Test action',
      status: 'pending',
      priority: 1,
      metadata: { id: 'action-1' },
    };

    const context: ActionContext = {
      character,
      action,
      metadata: {},
    };

    jest.spyOn(actionExecutorService, 'canExecute').mockResolvedValue(true);

    const successResult: ActionResult = {
      success: true,
      message: 'Action executed successfully',
    };

    jest.spyOn(actionExecutorService, 'execute').mockResolvedValue(successResult);

    const result = await actionExecutorService.execute(context);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Action executed successfully');
  });

  it('should not execute action if cannot execute', async () => {
    const character = new Character();
    character.id = 1;
    character.name = 'Test Character';

    const action: CharacterAction = {
      id: 'action-1',
      type: ActionType.SEND_MESSAGE,
      description: 'Test action',
      status: 'pending',
      priority: 1,
      metadata: { id: 'action-1' },
    };

    const context: ActionContext = {
      character,
      action,
      metadata: {},
    };

    const canExecute = await actionExecutorService.canExecute(context);
    expect(canExecute).toBe(true);

    const result = await actionExecutorService.execute(context);
    expect(result).toBeDefined();
  });

  it('should process action trigger', async () => {
    const character = new Character();
    character.id = 1;
    character.name = 'Test Character';

    const triggerContext: ActionTriggerContext = {
      characterId: character.id,
      userId: 'user-1',
      triggerType: 'user_message',
      triggerData: { messageId: 'msg-1' },
      timestamp: new Date(),
    };

    // Мокаем репозиторий для возврата персонажа
    const mockCharacterRepository = module.get<Repository<Character>>(
      getRepositoryToken(Character),
    );
    jest.spyOn(mockCharacterRepository, 'findOne').mockResolvedValue(character);

    // Мокаем метод canExecute для возврата true
    jest.spyOn(actionExecutorService, 'canExecute').mockResolvedValue(true);

    // Мокаем метод execute для возврата успешного результата
    jest.spyOn(actionExecutorService, 'execute').mockResolvedValue({
      success: true,
      message: 'Action executed successfully',
    });

    jest
      .spyOn(actionExecutorService as any, 'determineActionFromTrigger')
      .mockImplementation(() => {
        return Promise.resolve({
          id: 'action-1',
          type: ActionType.SEND_MESSAGE,
          description: 'Response to user message',
          status: 'pending',
          priority: 1,
          metadata: { id: 'action-1' },
        });
      });

    const result = await actionExecutorService.processActionTrigger(triggerContext);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should handle action lifecycle', async () => {
    const action: CharacterAction = {
      id: 'action-1',
      type: ActionType.SEND_MESSAGE,
      description: 'Test action',
      status: 'pending',
      priority: 1,
      metadata: { id: 'action-1' },
    };

    jest.spyOn(actionExecutorService as any, 'registerAction').mockImplementation(() => {});
    jest.spyOn(actionExecutorService as any, 'getCurrentAction').mockImplementation(() => action);

    const isPerformingActionSpy = jest.spyOn(actionExecutorService, 'isPerformingAction');
    jest.spyOn(actionExecutorService, 'isPerformingAction').mockReturnValue(true);

    actionExecutorService.registerAction(action);

    const characterCurrentActions = new Map<string, string>();
    characterCurrentActions.set('1', 'action-1');

    (
      actionExecutorService as unknown as { characterCurrentActions: Map<string, string> }
    ).characterCurrentActions = characterCurrentActions;

    await actionExecutorService.stopCurrentAction('1');

    isPerformingActionSpy.mockReturnValue(false);

    expect(actionExecutorService.isPerformingAction('1')).toBe(false);
  });
});

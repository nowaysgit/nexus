import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ActionExecutorService } from '../../src/character/services/action/action-executor.service';
import { Character } from '../../src/character/entities/character.entity';
import { ActionType } from '../../src/character/enums/action-type.enum';
import { LogService } from '../../src/logging/log.service';
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';
import { Repository } from 'typeorm';
import { ActionLifecycleService } from '../../src/character/services/action/action-lifecycle.service';
import { ActionSchedulerService } from '../../src/character/services/action/action-scheduler.service';
import { ActionGeneratorService } from '../../src/character/services/action/action-generator.service';
import { ActionResourceService } from '../../src/character/services/action/action-resource.service';
import { ModuleRef } from '@nestjs/core';

describe('ActionExecutorService Unit Tests', () => {
  let actionExecutorService: ActionExecutorService;
  let _mockCharacterRepository: jest.Mocked<Repository<Character>>;

  beforeEach(async () => {
    const mockCharacterRepo = {
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionExecutorService,
        {
          provide: ModuleRef,
          useValue: mockModuleRef,
        },
        {
          provide: getRepositoryToken(Character),
          useValue: mockCharacterRepo,
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
    _mockCharacterRepository = module.get(getRepositoryToken(Character));
  });

  it('должен быть определен', () => {
    expect(actionExecutorService).toBeDefined();
  });

  it('should create action with resources', () => {
    const characterId = 1;

    const result = actionExecutorService.createActionWithResources(characterId, ActionType.REST, {
      description: 'Персонаж отдыхает',
      resourceCost: 10,
    });

    expect(result).toBeDefined();
    expect(result.type).toBe(ActionType.REST);
  });

  it('должен останавливать текущее действие', async () => {
    const characterId = 'char-1';

    const result = await actionExecutorService.stopCurrentAction(characterId);

    // Проверяем, что метод был вызван без ошибок
    expect(result).toBe(true);
    expect(actionExecutorService).toBeDefined();
  });
});

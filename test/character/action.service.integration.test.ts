import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ActionService } from '../../src/character/services/action.service';
import { Character } from '../../src/character/entities/character.entity';
import { ActionType } from '../../src/character/enums/action-type.enum';
import { LogService } from '../../src/logging/log.service';
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';
import { Repository } from 'typeorm';
import { ActionExecutorService } from '../../src/character/services/action-executor.service';
import { ActionLifecycleService } from '../../src/character/services/action-lifecycle.service';
import { ActionSchedulerService } from '../../src/character/services/action-scheduler.service';
import { ActionGeneratorService } from '../../src/character/services/action-generator.service';
import { ModuleRef } from '@nestjs/core';

describe('ActionService Unit Tests', () => {
  let actionService: ActionService;
  let mockCharacterRepository: jest.Mocked<Repository<Character>>;

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
    } as any;

    const mockActionExecutorService = {
      getSupportedActionTypes: jest.fn(() => [ActionType.REST]),
      canExecute: jest.fn(() => Promise.resolve(true)),
      execute: jest.fn(() => Promise.resolve({ success: true })),
      interrupt: jest.fn(() => Promise.resolve()),
      determineAndPerformAction: jest.fn(() => Promise.resolve(null)),
      processActionTrigger: jest.fn(() => Promise.resolve({ success: true })),
      createActionWithResources: jest.fn(() =>
        Promise.resolve({
          id: '1',
          type: ActionType.REST,
          description: 'Персонаж отдыхает',
          resourceCost: 10,
        }),
      ),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionService,
        {
          provide: ModuleRef,
          useValue: mockModuleRef,
        },
        {
          provide: getRepositoryToken(Character),
          useValue: mockCharacterRepo,
        },
        {
          provide: ActionExecutorService,
          useValue: mockActionExecutorService,
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
          provide: LogService,
          useClass: MockLogService,
        },
      ],
    }).compile();

    actionService = module.get<ActionService>(ActionService);
    mockCharacterRepository = module.get(getRepositoryToken(Character));
  });

  it('должен быть определен', () => {
    expect(actionService).toBeDefined();
  });

  it('should create action with resources', async () => {
    const characterId = 1;

    const result = await actionService.createActionWithResources(characterId, ActionType.REST, {
      description: 'Персонаж отдыхает',
      resourceCost: 10,
    });

    expect(result).toBeDefined();
    expect(result.type).toBe(ActionType.REST);
  });

  it('должен прерывать действие', async () => {
    const characterId = 'char-1';

    await actionService.interruptAction(characterId);

    // Проверяем, что метод был вызван без ошибок
    expect(actionService).toBeDefined();
  });
});

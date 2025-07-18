import { Test, TestingModule } from '@nestjs/testing';
import { ActionResourceService } from '../../../src/character/services/action/action-resource.service';
import { NeedsService } from '../../../src/character/services/core/needs.service';
import { Character } from '../../../src/character/entities/character.entity';
import { ActionType } from '../../../src/character/enums/action-type.enum';
import { CharacterNeedType } from '../../../src/character/enums/character-need-type.enum';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';
import { MockLogService } from '../../../lib/tester/mocks/log.service.mock';
import { LogService } from '../../../src/logging/log.service';
import { ActionContext } from '../../../src/character/services/action/action-lifecycle.service';
import { CharacterAction } from '../../../src/character/interfaces/behavior.interfaces';

describe('ActionResourceService', () => {
  let service: ActionResourceService;
  let mockLogService: MockLogService;
  let mockNeedsService: jest.Mocked<NeedsService>;
  let testCharacter: Character;

  beforeEach(async () => {
    mockLogService = new MockLogService();
    mockNeedsService = {
      getActiveNeeds: jest.fn(),
      updateNeed: jest.fn(),
      processNeedsGrowth: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionResourceService,
        { provide: LogService, useValue: mockLogService },
        { provide: NeedsService, useValue: mockNeedsService },
      ],
    }).compile();

    service = module.get<ActionResourceService>(ActionResourceService);

    // Создаем тестового персонажа
    testCharacter = new Character();
    testCharacter.id = 1;
    testCharacter.name = 'Test Character';
    testCharacter.archetype = CharacterArchetype.COMPANION;
    testCharacter.biography = 'Test character biography';
    testCharacter.appearance = 'Test character appearance';
    testCharacter.personality = {
      traits: [],
      hobbies: [],
      fears: [],
      values: [],
      musicTaste: [],
      strengths: [],
      weaknesses: [],
    };
    testCharacter.isActive = true;
    testCharacter.createdAt = new Date();
    testCharacter.updatedAt = new Date();
    testCharacter.age = 25;
    testCharacter.energy = 100;
  });

  describe('checkResourceAvailability', () => {
    it('должен возвращать true при достаточном количестве энергии', async () => {
      const action: CharacterAction = {
        type: ActionType.SEND_MESSAGE,
        description: 'Test action',
        status: 'pending',
        startTime: new Date(),
        duration: 1000,
        relatedNeeds: [CharacterNeedType.COMMUNICATION],
        metadata: {
          resourceCost: 10,
        },
      };

      const context: ActionContext = {
        character: testCharacter,
        action,
        metadata: { timestamp: new Date() },
      };

      mockNeedsService.getActiveNeeds.mockResolvedValue([
        { type: CharacterNeedType.REST, currentValue: 50 },
      ] as any);

      const result = await service.checkResourceAvailability(context);
      expect(result).toBe(true);
    });

    it('должен возвращать false при недостаточном количестве энергии', async () => {
      const action: CharacterAction = {
        type: ActionType.WORK,
        description: 'Hard work',
        status: 'pending',
        startTime: new Date(),
        duration: 1000,
        relatedNeeds: [CharacterNeedType.ACHIEVEMENT],
        metadata: {
          resourceCost: 50,
        },
      };

      const context: ActionContext = {
        character: testCharacter,
        action,
        metadata: { timestamp: new Date() },
      };

      mockNeedsService.getActiveNeeds.mockResolvedValue([
        { type: CharacterNeedType.REST, currentValue: 5 },
      ] as any);

      const result = await service.checkResourceAvailability(context);
      expect(result).toBe(false);
    });

    it('должен возвращать true для действий с отрицательной стоимостью (восстанавливающих)', async () => {
      const action: CharacterAction = {
        type: ActionType.REST,
        description: 'Rest action',
        status: 'pending',
        startTime: new Date(),
        duration: 1000,
        relatedNeeds: [CharacterNeedType.REST],
        metadata: {
          resourceCost: -20,
        },
      };

      const context: ActionContext = {
        character: testCharacter,
        action,
        metadata: { timestamp: new Date() },
      };

      const result = await service.checkResourceAvailability(context);
      expect(result).toBe(true);
    });
  });

  describe('executeActionWithResources', () => {
    it('должен выполнить действие успешно при наличии ресурсов', async () => {
      const action: CharacterAction = {
        type: ActionType.SEND_MESSAGE,
        description: 'Send message',
        status: 'pending',
        startTime: new Date(),
        duration: 1000,
        relatedNeeds: [CharacterNeedType.COMMUNICATION],
        metadata: {
          resourceCost: 10,
          successProbability: 100, // 100% успеха для предсказуемости
        },
      };

      const context: ActionContext = {
        character: testCharacter,
        action,
        metadata: { timestamp: new Date() },
      };

      mockNeedsService.getActiveNeeds.mockResolvedValue([
        { type: CharacterNeedType.REST, currentValue: 50 },
      ] as any);
      mockNeedsService.updateNeed.mockResolvedValue({} as any);

      const result = await service.executeActionWithResources(context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Действие выполнено успешно');
      expect(result.resourceCost).toBe(10);
      expect(result.effectiveness).toBe(100);
    });

    it('должен возвращать неуспех при недостатке ресурсов', async () => {
      const action: CharacterAction = {
        type: ActionType.WORK,
        description: 'Work hard',
        status: 'pending',
        startTime: new Date(),
        duration: 1000,
        relatedNeeds: [CharacterNeedType.ACHIEVEMENT],
        metadata: {
          resourceCost: 50,
        },
      };

      const context: ActionContext = {
        character: testCharacter,
        action,
        metadata: { timestamp: new Date() },
      };

      mockNeedsService.getActiveNeeds.mockResolvedValue([
        { type: CharacterNeedType.REST, currentValue: 5 },
      ] as any);

      const result = await service.executeActionWithResources(context);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Недостаточно ресурсов для выполнения действия');
      expect(result.resourceCost).toBe(0);
    });

    it('должен применять пониженную стоимость при неудаче', async () => {
      const action: CharacterAction = {
        type: ActionType.CONFESS,
        description: 'Confess feelings',
        status: 'pending',
        startTime: new Date(),
        duration: 1000,
        relatedNeeds: [CharacterNeedType.AFFECTION],
        metadata: {
          resourceCost: 40,
          successProbability: 0, // 0% успеха для предсказуемости
        },
      };

      const context: ActionContext = {
        character: testCharacter,
        action,
        metadata: { timestamp: new Date() },
      };

      mockNeedsService.getActiveNeeds.mockResolvedValue([
        { type: CharacterNeedType.REST, currentValue: 50 },
      ] as any);
      mockNeedsService.updateNeed.mockResolvedValue({} as any);

      const result = await service.executeActionWithResources(context);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Недостаточно ресурсов для выполнения действия');
      expect(result.resourceCost).toBe(0); // нет затрат при недостатке ресурсов
      expect(result.effectiveness).toBeUndefined();
    });
  });

  describe('createActionWithResources', () => {
    it('должен создавать действие с настройками ресурсов', () => {
      const options = {
        resourceCost: 25,
        successProbability: 80,
        description: 'Custom action',
        potentialReward: { experience: 10 },
      };

      const action = service.createActionWithResources(
        testCharacter.id,
        ActionType.CUSTOM,
        options,
      );

      expect(action.type).toBe(ActionType.CUSTOM);
      expect(action.description).toBe('Custom action');
      expect(action.status).toBe('pending');
      expect(action.metadata.characterId).toBe(testCharacter.id);
      expect(action.metadata.resourceCost).toBe(25);
      expect(action.metadata.successProbability).toBe(80);
      expect(action.metadata.potentialReward).toEqual({ experience: 10 });
    });

    it('должен использовать значения по умолчанию', () => {
      const action = service.createActionWithResources(testCharacter.id, ActionType.SEND_MESSAGE);

      expect(action.metadata.resourceCost).toBe(10); // Значение по умолчанию для SEND_MESSAGE
      expect(action.metadata.successProbability).toBe(85); // Значение по умолчанию для SEND_MESSAGE
    });
  });

  describe('getDefaultResourceCost', () => {
    it('должен возвращать правильную стоимость для различных типов действий', () => {
      expect(service.getDefaultResourceCost(ActionType.SEND_MESSAGE)).toBe(10);
      expect(service.getDefaultResourceCost(ActionType.WORK)).toBe(50);
      expect(service.getDefaultResourceCost(ActionType.REST)).toBe(-20);
      expect(service.getDefaultResourceCost(ActionType.SLEEP)).toBe(-30);
    });

    it('должен возвращать значение по умолчанию для неизвестных типов', () => {
      expect(service.getDefaultResourceCost('UNKNOWN_ACTION' as ActionType)).toBe(25);
    });
  });

  describe('getDefaultSuccessProbability', () => {
    it('должен возвращать правильную вероятность успеха для различных типов действий', () => {
      expect(service.getDefaultSuccessProbability(ActionType.ASK_QUESTION)).toBe(90);
      expect(service.getDefaultSuccessProbability(ActionType.CONFESS)).toBe(60);
      expect(service.getDefaultSuccessProbability(ActionType.JOKE)).toBe(80);
    });
  });

  describe('getDefaultReward', () => {
    it('должен возвращать награды для различных типов действий', () => {
      const messageReward = service.getDefaultReward(ActionType.SEND_MESSAGE);
      const workReward = service.getDefaultReward(ActionType.WORK);

      expect(messageReward).toBeDefined();
      expect(workReward).toBeDefined();
      expect(typeof messageReward).toBe('object');
      expect(typeof workReward).toBe('object');
    });
  });

  describe('интеграционные тесты', () => {
    it('должен корректно обрабатывать полный цикл действия', async () => {
      const action = service.createActionWithResources(testCharacter.id, ActionType.SEND_MESSAGE, {
        successProbability: 100,
      });

      const context: ActionContext = {
        character: testCharacter,
        action,
        metadata: { timestamp: new Date() },
      };

      mockNeedsService.getActiveNeeds.mockResolvedValue([
        { type: CharacterNeedType.REST, currentValue: 50 },
      ] as any);
      mockNeedsService.updateNeed.mockResolvedValue({} as any);

      // Проверяем доступность ресурсов
      const isAvailable = await service.checkResourceAvailability(context);
      expect(isAvailable).toBe(true);

      // Выполняем действие
      const result = await service.executeActionWithResources(context);
      expect(result.success).toBe(true);
      expect(result.resourceCost).toBe(10);
    });

    it('должен обрабатывать неуспешные действия с частичной стоимостью', async () => {
      const action = service.createActionWithResources(testCharacter.id, ActionType.CONFESS, {
        successProbability: 0, // Гарантированный неуспех
      });

      const context: ActionContext = {
        character: testCharacter,
        action,
        metadata: { timestamp: new Date() },
      };

      mockNeedsService.getActiveNeeds.mockResolvedValue([
        { type: CharacterNeedType.REST, currentValue: 50 },
      ] as any);
      mockNeedsService.updateNeed.mockResolvedValue({} as any);

      const result = await service.executeActionWithResources(context);
      expect(result.success).toBe(false);
      expect(result.resourceCost).toBe(0);
      expect(result.effectiveness).toBeUndefined();
    });
  });

  describe('обработка ошибок', () => {
    it('должен обрабатывать ошибки при проверке доступности ресурсов', async () => {
      const action: CharacterAction = {
        type: ActionType.SEND_MESSAGE,
        description: 'Test action',
        status: 'pending',
        startTime: new Date(),
        duration: 1000,
        relatedNeeds: [CharacterNeedType.COMMUNICATION],
        metadata: { resourceCost: 10 },
      };

      const context: ActionContext = {
        character: testCharacter,
        action,
        metadata: { timestamp: new Date() },
      };

      mockNeedsService.getActiveNeeds.mockRejectedValue(new Error('Database error'));

      await expect(service.checkResourceAvailability(context)).rejects.toThrow();
    });

    it('должен обрабатывать ошибки при выполнении действия', async () => {
      const action: CharacterAction = {
        type: ActionType.SEND_MESSAGE,
        description: 'Test action',
        status: 'pending',
        startTime: new Date(),
        duration: 1000,
        relatedNeeds: [CharacterNeedType.COMMUNICATION],
        metadata: { resourceCost: 10 },
      };

      const context: ActionContext = {
        character: testCharacter,
        action,
        metadata: { timestamp: new Date() },
      };

      mockNeedsService.getActiveNeeds.mockResolvedValue([
        { type: CharacterNeedType.REST, currentValue: 50 },
      ] as any);
      mockNeedsService.updateNeed.mockRejectedValue(new Error('Update error'));

      await expect(service.executeActionWithResources(context)).rejects.toThrow();
    });
  });
});

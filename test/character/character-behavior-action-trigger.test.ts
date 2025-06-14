import { createTestSuite, createTest, TestConfigType, Tester } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures';
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
  let tester: Tester;
  let fixtureManager: FixtureManager;
  let dataSource: DataSource;

  beforeAll(async () => {
    tester = Tester.getInstance();
    dataSource = await tester.setupTestEnvironment(TestConfigType.DATABASE);
    fixtureManager = new FixtureManager(dataSource);
  });
  afterAll(async () => {
    await tester.forceCleanup();
  });
  beforeEach(async () => {
    await fixtureManager.cleanDatabase();
  });
  createTest(
    {
      name: 'should correctly process an action trigger with motivations',
      configType: TestConfigType.DATABASE,
    },
    async context => {
      const behaviorService = context.get(CharacterBehaviorService);
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

      jest
        .spyOn(CharacterBehaviorService.prototype as any, 'selectActionForMotivation')
        .mockResolvedValue({
          type: ActionType.SEND_MESSAGE,
          description: 'Test Action',
          content: 'Hello',
        });
      const result = await behaviorService.processActionTrigger(
        character.id,
        'user_message',
        motivations,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      if (result.success) {
        const actionData = result.data;
        expect((actionData.action as { type: ActionType }).type).toBe(ActionType.SEND_MESSAGE);
      }
    },
  );

  createTest(
    {
      name: 'should correctly process an action trigger with emotional context',
      configType: TestConfigType.DATABASE,
    },
    async context => {
      const behaviorService = context.get(CharacterBehaviorService);
      const emotionalStateService = context.get(EmotionalStateService);
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({ user });
      await emotionalStateService.updateEmotionalState(character.id, {
        primary: 'joy',
        secondary: 'interest',
        intensity: 0.7,
        primaryChange: 0.1,
        secondaryChange: 0.1,
        source: 'user_message',
        description: 'Happy and interested state',
      } as any);

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

      jest
        .spyOn(CharacterBehaviorService.prototype as any, 'selectActionForMotivation')
        .mockResolvedValue({
          type: ActionType.EXPRESS_EMOTION,
          description: 'Expressing joy',
          content: 'I am so happy!',
          metadata: { emotion: 'joy' },
        });
      const result = await behaviorService.processActionTrigger(
        character.id,
        'emotional_response',
        motivations,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      if (result.success) {
        const actionData = result.data;
        const action = actionData.action as { type: ActionType; metadata: { emotion: string } };
        expect(action.type).toBe(ActionType.EXPRESS_EMOTION);
        expect(action.metadata.emotion).toBe('joy');
      }
    },
  );

  createTest(
    {
      name: 'should update needs after action execution',
      configType: TestConfigType.DATABASE,
    },
    async context => {
      const behaviorService = context.get(CharacterBehaviorService);
      const needsService = context.get(NeedsService);
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({ user });
      await fixtureManager.createNeed({
        character,
        type: CharacterNeedType.FUN,
        currentValue: 90,
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

      jest
        .spyOn(CharacterBehaviorService.prototype as any, 'selectActionForMotivation')
        .mockResolvedValue({
          type: ActionType.ENTERTAINMENT,
          description: 'Play a fun game',
          content: 'Let us play!',
          relatedNeeds: [{ needType: CharacterNeedType.FUN, impact: -50 }],
        });
      await behaviorService.processActionTrigger(character.id, 'fun_activity', motivations);

      const updatedNeeds = await needsService.getNeeds(character.id);
      const updatedFunNeed = updatedNeeds.find(need => need.type === CharacterNeedType.FUN);
      expect(updatedFunNeed?.currentValue).toBeLessThan(90);
    },
  );

  createTest(
    {
      name: 'должен корректно обрабатывать триггеры действий',
      configType: TestConfigType.DATABASE,
    },
    async context => {
      const characterBehaviorService = context.get(CharacterBehaviorService);
      const actionService = context.get(ActionService);
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({ user });

      // Define the context for the action trigger
      const actionTriggerContext: ActionTriggerContext = {
        characterId: character.id,
        userId: Number(user.id),
        triggerType: 'user_request',
        triggerData: { message: 'test' },
        timestamp: new Date(),
        motivations: [],
        needsExpression: 'test need',
        emotionalResponse: null,
        messagePrompt: 'test',
      };

      const determineAndPerformActionSpy = jest
        .spyOn(actionService, 'determineAndPerformAction')
        .mockResolvedValue({
          success: true,
          data: null,
          type: ActionType.SEND_MESSAGE,
          description: 'Test action',
        } as CharacterAction);

      // Use the actionTriggerContext in the processActionTrigger call
      await characterBehaviorService.processActionTrigger(
        actionTriggerContext.characterId,
        actionTriggerContext.triggerType,
        actionTriggerContext.motivations,
      );

      expect(determineAndPerformActionSpy).toHaveBeenCalled();
    },
  );
});

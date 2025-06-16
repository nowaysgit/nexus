import { TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

// Entities
import { Character } from '../../src/character/entities/character.entity';
import { Need } from '../../src/character/entities/need.entity';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { CharacterMotivation } from '../../src/character/entities/character-motivation.entity';
import { Action } from '../../src/character/entities/action.entity';
import { CharacterMemory } from '../../src/character/entities/character-memory.entity';
import { StoryEvent } from '../../src/character/entities/story-event.entity';
import { StoryPlan, StoryMilestone } from '../../src/character/entities/story-plan.entity';
import { ActionType } from '../../src/character/enums/action-type.enum';

// Services
import { CharacterService } from '../../src/character/services/character.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { ActionService } from '../../src/character/services/action.service';

// Tester utilities
import { TestModuleBuilder, createTestSuite, createTest } from '../../lib/tester';

createTestSuite('Action Service Integration Tests', () => {
  let moduleRef: TestingModule | null = null;
  let characterService: CharacterService;
  let needsService: NeedsService;
  let actionService: ActionService;
  let actionRepository: Repository<Action>;

  beforeEach(async () => {
    moduleRef = await TestModuleBuilder.create()
      .withImports([
        TypeOrmModule.forFeature([
          Character,
          Need,
          CharacterMotivation,
          Action,
          CharacterMemory,
          StoryEvent,
          StoryPlan,
          StoryMilestone,
        ]),
      ])
      .withProviders([CharacterService, NeedsService, ActionService])
      .withRequiredMocks()
      .compile();

    characterService = moduleRef.get<CharacterService>(CharacterService);
    actionService = moduleRef.get<ActionService>(ActionService);
    needsService = moduleRef.get<NeedsService>(NeedsService);
    actionRepository = moduleRef.get<Repository<Action>>(getRepositoryToken(Action));
  });

  afterEach(async () => {
    if (moduleRef) {
      try {
        const dataSource = moduleRef.get<DataSource>('DataSource');
        if (dataSource?.isInitialized) {
          await dataSource.destroy();
        }
      } catch (_) {
        // ignore if datasource not found
      }

      await moduleRef.close();
      moduleRef = null;
    }
  });

  createTest(
    {
      name: 'should create, execute and track actions',
      requiresDatabase: true,
    },
    async () => {
      // Create a character
      const character = await characterService.create({
        name: 'Петр',
        age: 32,
        biography: 'Активный предприниматель',
        appearance: 'Деловой стиль, уверенная походка',
        personality: {
          traits: ['решительный', 'амбициозный'],
          hobbies: ['бизнес', 'переговоры'],
          fears: ['неудача'],
          values: ['успех', 'достижения'],
          musicTaste: ['классика', 'джаз'],
          strengths: ['коммуникабельность', 'стратегическое мышление'],
          weaknesses: ['нетерпеливость'],
        },
        isActive: true,
      });

      // Create default needs
      await needsService.createDefaultNeeds(character.id);

      // Инициализируем активный чат для персонажа
      actionService.updateChatState(character.id.toString(), 'test-user-id', true);

      // Create an action
      const action = await actionService.createActionWithResources(
        character.id,
        ActionType.SEND_MESSAGE,
        {
          resourceCost: 15,
          successProbability: 80,
          potentialReward: { communication: 25, rest: -5 },
          description: 'Отправка важного сообщения',
        },
      );

      expect(action).toBeDefined();
      expect(action.type).toBe(ActionType.SEND_MESSAGE);

      // Check if action can be executed
      const actionContext = {
        character,
        action,
        metadata: { testMessage: 'Тестовое сообщение' },
      };

      const canExecute = await actionService.canExecute(actionContext);
      expect(canExecute).toBe(true);

      // Execute the action
      const result = await actionService.execute(actionContext);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      // Clean up
      await actionRepository.delete({ characterId: character.id });
      await characterService.delete(character.id);
    },
  );

  createTest(
    {
      name: 'should handle action failures and resource management',
      requiresDatabase: true,
    },
    async () => {
      // Create a character with low resources
      const character = await characterService.create({
        name: 'Анна',
        age: 28,
        biography: 'Уставшая студентка',
        personality: {
          traits: ['умная', 'уставшая'],
          hobbies: ['учеба', 'сон'],
          fears: ['экзамены'],
          values: ['знания', 'отдых'],
          musicTaste: ['инди', 'классика'],
          strengths: ['аналитическое мышление'],
          weaknesses: ['прокрастинация'],
        },
        isActive: true,
      });

      // Create default needs
      await needsService.createDefaultNeeds(character.id);

      // Сначала сбросим потребность REST до 0
      await needsService.resetNeed(character.id, CharacterNeedType.REST);

      // Затем установим значение потребности REST на 10 (очень низкое)
      await needsService.updateNeed(character.id, {
        type: CharacterNeedType.REST,
        change: 10,
        reason: 'Тестовая усталость',
      });

      // Проверим, что потребность REST действительно установлена на 10
      const needs = await needsService.getActiveNeeds(character.id);
      const restNeed = needs.find(need => need.type === CharacterNeedType.REST);
      expect(restNeed).toBeDefined();
      expect(restNeed?.currentValue).toBe(10);

      // Create a high-cost action
      const action = await actionService.createActionWithResources(character.id, ActionType.WORK, {
        resourceCost: 80,
        successProbability: 30,
        potentialReward: { knowledge: 50, rest: -40 },
        description: 'Учеба всю ночь перед экзаменом',
      });

      expect(action).toBeDefined();
      expect(action.metadata?.resourceCost).toBe(80);

      // Check if action can be executed (should be false due to high cost)
      const actionContext = {
        character,
        action,
        metadata: { subject: 'Математика' },
      };

      // Отладочный вывод для проверки значений
      console.log('DEBUG: REST need value:', restNeed?.currentValue);
      console.log('DEBUG: Action resource cost:', action.metadata?.resourceCost);

      const canExecute = await actionService.canExecute(actionContext);
      console.log('DEBUG: canExecute result:', canExecute);

      expect(canExecute).toBe(false); // Should not be executable due to high cost

      // Try to execute anyway (should fail or have low success rate)
      const result = await actionService.execute(actionContext);
      expect(result).toBeDefined();
      expect(result.success).toBe(false); // Should fail because canExecute returned false

      // Clean up
      await actionRepository.delete({ characterId: character.id });
      await characterService.delete(character.id);
    },
  );
});

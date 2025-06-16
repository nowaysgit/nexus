import { TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

// Entities
import { Character } from '../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { ActionType } from '../../src/character/enums/action-type.enum';
import { Need } from '../../src/character/entities/need.entity';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { CharacterMotivation } from '../../src/character/entities/character-motivation.entity';
import { Action } from '../../src/character/entities/action.entity';
import { CharacterMemory } from '../../src/character/entities/character-memory.entity';

// Services
import { CharacterService } from '../../src/character/services/character.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { MotivationService } from '../../src/character/services/motivation.service';
import { ActionService } from '../../src/character/services/action.service';
import { MemoryService } from '../../src/character/services/memory.service';

// Tester utilities
import { TestModuleBuilder, createTestSuite, createTest } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';

createTestSuite('Needs and Motivation Workflow Integration Tests', () => {
  let moduleRef: TestingModule | null = null;
  let motivationService: MotivationService;
  let actionService: ActionService;
  let _characterRepository: Repository<Character>;
  let _needRepository: Repository<Need>;
  let _actionRepository: Repository<Action>;
  let fixtureManager: FixtureManager;
  let needsService: NeedsService;

  beforeEach(async () => {
    moduleRef = await TestModuleBuilder.create()
      .withImports([
        TypeOrmModule.forFeature([Character, Need, CharacterMotivation, Action, CharacterMemory]),
      ])
      .withProviders([
        CharacterService,
        NeedsService,
        MotivationService,
        ActionService,
        MemoryService,
      ])
      .withRequiredMocks()
      .compile();

    motivationService = moduleRef.get<MotivationService>(MotivationService);
    actionService = moduleRef.get<ActionService>(ActionService);
    _characterRepository = moduleRef.get<Repository<Character>>(getRepositoryToken(Character));
    _needRepository = moduleRef.get<Repository<Need>>(getRepositoryToken(Need));
    _actionRepository = moduleRef.get<Repository<Action>>(getRepositoryToken(Action));
    needsService = moduleRef.get<NeedsService>(NeedsService);

    // Инициализируем FixtureManager для удобного создания зависимых сущностей
    const dataSource = moduleRef.get<DataSource>(DataSource);
    fixtureManager = new FixtureManager(dataSource);

    await fixtureManager.cleanDatabase();
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
      moduleRef = null;
    }
  });

  createTest(
    {
      name: 'should create character and initialize needs',
      requiresDatabase: true,
    },
    async () => {
      const user = await fixtureManager.createUser({ email: 'anna@example.com' });

      const character = await fixtureManager.createCharacter({
        name: 'Анна',
        age: 25,
        archetype: CharacterArchetype.HERO,
        user,
        userId: user.id,
        biography: 'Общительная девушка, которая любит внимание',
        appearance: 'Привлекательная девушка с яркой улыбкой',
        personality: {
          traits: ['общительная', 'эмоциональная', 'активная'],
          hobbies: ['общение', 'музыка', 'танцы'],
          fears: ['одиночество', 'игнорирование'],
          values: ['дружба', 'внимание', 'признание'],
          musicTaste: ['поп', 'танцевальная'],
          strengths: ['коммуникабельность', 'эмпатия'],
          weaknesses: ['зависимость от внимания'],
        },
        isActive: true,
      });
      expect(character).toBeDefined();
      expect(character.name).toBe('Анна');

      await needsService.createDefaultNeeds(character.id);

      const needs = await needsService.getNeedsByCharacter(character.id);
      expect(needs).toBeDefined();
      expect(needs.length).toBeGreaterThan(0);

      const communicationNeed = needs.find(need => need.type === CharacterNeedType.COMMUNICATION);
      expect(communicationNeed).toBeDefined();
      expect(communicationNeed.currentValue).toBeGreaterThanOrEqual(0);

      await needsService.updateNeed(character.id, {
        type: CharacterNeedType.COMMUNICATION,
        change: 50,
        reason: 'Тестовое накопление потребности',
      });
      const motivation = await motivationService.createMotivation(
        character.id,
        CharacterNeedType.COMMUNICATION,
        'Желание общаться',
        80,
        {
          thresholdValue: 70,
          accumulationRate: 1.5,
          resourceCost: 20,
          successProbability: 70,
        },
      );

      expect(motivation).toBeDefined();
      if (motivation) {
        expect(motivation.characterId).toBe(character.id);
      }
    },
  );

  createTest(
    {
      name: 'should handle action service integration',
      requiresDatabase: true,
    },
    async () => {
      const user = await fixtureManager.createUser({ email: 'victor@example.com' });

      const character = await fixtureManager.createCharacter({
        name: 'Виктор',
        age: 32,
        archetype: CharacterArchetype.HERO,
        user,
        userId: user.id,
        biography: 'Активный парень, который любит действовать',
        personality: {
          traits: ['активный', 'целеустремленный'],
          hobbies: ['спорт', 'работа'],
          fears: ['бездействие'],
          values: ['достижения', 'прогресс'],
          musicTaste: ['рок', 'электронная'],
          strengths: ['энергичность'],
          weaknesses: ['нетерпеливость'],
        },
        isActive: true,
        appearance: 'Спортивный мужчина среднего роста',
      });

      const action = await actionService.createActionWithResources(character.id, ActionType.WORK, {
        resourceCost: 10,
        successProbability: 0.8,
        potentialReward: { communication: 30 },
        description: 'Отправка сообщения',
      });

      expect(action).toBeDefined();
      expect(action.metadata.id).toBeDefined();

      const actionContext = {
        character,
        action,
        metadata: { testExecution: true },
      };

      const canExecute = await actionService.canExecute(actionContext);
      expect(canExecute).toBe(true);

      const result = await actionService.execute(actionContext);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    },
  );

  createTest(
    {
      name: 'should create third character and initialize needs',
      requiresDatabase: true,
    },
    async () => {
      const user = await fixtureManager.createUser({ email: 'maria@example.com' });

      const character = await fixtureManager.createCharacter({
        name: 'Мария',
        age: 22,
        archetype: CharacterArchetype.HERO,
        user,
        userId: user.id,
        biography: 'Студентка, которая много учится',
        personality: {
          traits: ['умная', 'целеустремленная'],
          hobbies: ['учеба', 'книги'],
          fears: ['неудача'],
          values: ['знания', 'прогресс'],
          musicTaste: ['классика', 'джаз'],
          strengths: ['интеллект'],
          weaknesses: ['перфекционизм'],
        },
        isActive: true,
        appearance: 'Уставшая студентка с темными кругами под глазами',
      });

      const action = await actionService.createActionWithResources(character.id, ActionType.WORK, {
        resourceCost: 10,
        successProbability: 0.8,
        potentialReward: { communication: 30 },
        description: 'Отправка сообщения',
      });

      expect(action).toBeDefined();
      expect(action.metadata.id).toBeDefined();

      const actionContext = {
        character,
        action,
        metadata: { testExecution: true },
      };

      const canExecute = await actionService.canExecute(actionContext);
      expect(canExecute).toBe(true);

      const result = await actionService.execute(actionContext);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    },
  );
});

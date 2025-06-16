import { createTestSuite, createTest } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { ActionService } from '../../src/character/services/action.service';
import { ActionType } from '../../src/character/enums/action-type.enum';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { NeedsService } from '../../src/character/services/needs.service';
import { DataSource } from 'typeorm';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { IMotivation } from '../../src/character/interfaces/needs.interfaces';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Character } from '../../src/character/entities/character.entity';
import { Need } from '../../src/character/entities/need.entity';
import { Action } from '../../src/character/entities/action.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MemoryService } from '../../src/character/services/memory.service';
import { CharacterMemory } from '../../src/character/entities/character-memory.entity';
import { LogService } from '../../src/logging/log.service';
import { MockLogService } from '../../lib/tester/mocks';

createTestSuite('ActionService - Интеграционные тесты', () => {
  let fixtureManager: FixtureManager;
  let actionService: ActionService;
  let needsService: NeedsService;
  let dataSource: DataSource;
  let moduleRef: import('@nestjs/testing').TestingModule | null = null;

  beforeEach(async () => {
    moduleRef = await TestModuleBuilder.create()
      .withImports([TypeOrmModule.forFeature([Character, Need, Action, CharacterMemory])])
      .withProviders([
        NeedsService,
        MemoryService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useClass: MockLogService,
        },
        ActionService,
      ])
      .withRequiredMocks()
      .compile();

    dataSource = moduleRef.get(DataSource);
    fixtureManager = new FixtureManager(dataSource);
    actionService = moduleRef.get(ActionService);
    needsService = moduleRef.get(NeedsService);

    // Очищаем базу данных перед тестом
    await fixtureManager.cleanDatabase();

    // Вручную устанавливаем зависимости, которые обычно устанавливаются через onModuleInit
    Object.defineProperty(actionService, 'needsService', { value: needsService });
    const memoryService = moduleRef.get<MemoryService>(MemoryService);
    Object.defineProperty(actionService, 'memoryService', { value: memoryService });
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
      moduleRef = null;
    }
  });

  createTest(
    {
      name: 'должен создавать действие и обновлять потребности персонажа',
      requiresDatabase: true,
    },
    async () => {
      // Создаем тестового пользователя
      const user = await fixtureManager.createUser({});

      // Создаем тестового персонажа с потребностями
      const character = await fixtureManager.createCharacter({ user });

      // Создаем потребность REST с низким значением, чтобы видеть увеличение
      await fixtureManager.createNeed({
        character,
        type: CharacterNeedType.REST,
        currentValue: 50,
      });

      // Создаем потребность COMMUNICATION
      await fixtureManager.createNeed({
        character,
        type: CharacterNeedType.COMMUNICATION,
        currentValue: 70,
      });

      // Создаем действие REST
      const action = await actionService.createActionWithResources(character.id, ActionType.REST, {
        resourceCost: 10, // Небольшая стоимость ресурсов
        successProbability: 90,
        potentialReward: { rest: 15 }, // Увеличение потребности в отдыхе
        description: 'Отдых персонажа',
      });

      // Проверяем, что действие создано корректно
      expect(action).toBeDefined();
      expect(action.type).toBe(ActionType.REST);
      expect(action.metadata?.resourceCost).toBe(10);
      expect(action.metadata?.successProbability).toBe(90);

      // Получаем потребности персонажа до выполнения действия
      const needsBefore = await needsService.getActiveNeeds(character.id);
      const restNeedBefore = needsBefore.find(need => need.type === CharacterNeedType.REST);
      const commNeedBefore = needsBefore.find(
        need => need.type === CharacterNeedType.COMMUNICATION,
      );

      expect(restNeedBefore?.currentValue).toBe(50);
      expect(commNeedBefore?.currentValue).toBe(70);

      // Выполняем действие
      const context = {
        character,
        action,
        metadata: { duration: 30 }, // Длительность отдыха в минутах
      };

      // Проверяем ресурсы напрямую
      const hasResources = await actionService['checkResourceAvailability'](context);
      console.log('Результат проверки ресурсов:', hasResources);

      // Получаем все поддерживаемые типы действий
      const supportedTypes = actionService.getSupportedActionTypes();
      console.log('Поддерживаемые типы действий:', supportedTypes);
      console.log('Тип действия в тесте:', action.type);
      console.log('Действие поддерживается:', supportedTypes.includes(action.type));

      // Проверяем возможность выполнения
      const canExecute = await actionService.canExecute(context);
      console.log('Результат canExecute:', canExecute);
      expect(canExecute).toBe(true);

      // Выполняем действие
      const result = await actionService.execute(context);

      // Проверяем результат выполнения
      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Получаем обновленные потребности персонажа
      const needsAfter = await needsService.getActiveNeeds(character.id);
      const restNeedAfter = needsAfter.find(need => need.type === CharacterNeedType.REST);
      const commNeedAfter = needsAfter.find(need => need.type === CharacterNeedType.COMMUNICATION);

      console.log('Потребность REST до:', restNeedBefore?.currentValue);
      console.log('Потребность REST после:', restNeedAfter?.currentValue);
      console.log('Потребность COMMUNICATION до:', commNeedBefore?.currentValue);
      console.log('Потребность COMMUNICATION после:', commNeedAfter?.currentValue);

      // Проверяем, что потребность в отдыхе увеличилась после отдыха
      if (restNeedAfter && restNeedBefore) {
        expect(restNeedAfter.currentValue).toBeGreaterThanOrEqual(restNeedBefore.currentValue);
      }

      // Проверяем, что потребность в общении могла уменьшиться (из-за стоимости ресурсов)
      if (commNeedAfter && commNeedBefore) {
        expect(commNeedAfter.currentValue).toBeLessThanOrEqual(commNeedBefore.currentValue);
      }
    },
  );

  createTest(
    {
      name: 'должен обрабатывать триггеры действий',
      requiresDatabase: true,
    },
    async () => {
      // Создаем тестового пользователя
      const user = await fixtureManager.createUser({});

      // Создаем тестового персонажа
      const character = await fixtureManager.createCharacter({ user });

      // Создаем потребности для персонажа
      await fixtureManager.createNeed({
        character,
        type: CharacterNeedType.REST,
        currentValue: 80,
      });

      await fixtureManager.createNeed({
        character,
        type: CharacterNeedType.COMMUNICATION,
        currentValue: 90, // Высокая потребность в общении
      });

      // Создаем мотивацию как объект, соответствующий интерфейсу IMotivation
      const motivation: IMotivation = {
        id: 1,
        characterId: character.id,
        needType: CharacterNeedType.COMMUNICATION,
        intensity: 80,
        status: 'active',
      };

      // Создаем триггер для действия (сообщение от пользователя)
      const result = await actionService.processActionTrigger({
        characterId: character.id,
        userId: user.id.toString(),
        triggerType: 'message',
        triggerData: { content: 'Привет, как дела?' },
        timestamp: new Date(),
        motivations: [motivation],
        needsExpression: 'Персонаж хочет общаться',
        emotionalResponse: 'Радость от общения',
        messagePrompt: 'Ответить на приветствие',
      });

      // Проверяем результат обработки триггера
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    },
  );
});

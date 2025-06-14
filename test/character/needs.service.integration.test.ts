import { Tester, createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures';
import { NeedsService } from '../../src/character/services/needs.service';
import { INeedUpdate } from '../../src/character/interfaces/needs.interfaces';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { DataSource } from 'typeorm';
import { TestConfigurations } from '../../lib/tester/test-configurations';
import { Need } from '../../src/character/entities/need.entity';
import { Character } from '../../src/character/entities/character.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LogService } from '../../src/logging/log.service';

createTestSuite('NeedsService Integration Tests', () => {
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
      name: 'должен создавать потребности по умолчанию для персонажа',
      configType: TestConfigType.DATABASE,
      imports: [],
      providers: [
        {
          provide: NeedsService,
          useFactory: () => {
            return new NeedsService(
              dataSource.getRepository(Need),
              dataSource.getRepository(Character),
              new EventEmitter2(),
              tester.get(LogService),
            );
          },
        },
        ...TestConfigurations.addLoggingMocks(),
      ],
    },
    async context => {
      const needsService = context.get(NeedsService);

      const testCharacter = await fixtureManager.createCharacter();
      const needs = await needsService.createDefaultNeeds(testCharacter.id);

      expect(needs).toBeDefined();
      expect(needs.length).toBe(10);

      const needTypes = needs.map(need => need.type);
      expect(needTypes).toContain(CharacterNeedType.ATTENTION);
      expect(needTypes).toContain(CharacterNeedType.CONNECTION);
      expect(needTypes).toContain(CharacterNeedType.COMMUNICATION);

      // Проверяем начальные параметры каждой потребности
      needs.forEach(need => {
        expect(need.currentValue).toBe(0); // Начальный уровень должен быть 0
        expect(need.threshold).toBeDefined(); // Пороговое значение должно быть определено
        expect(need.priority).toBeDefined(); // Приоритет должен быть определен
        expect(need.priority).toBeGreaterThanOrEqual(4); // Приоритет должен быть >= 4
        expect(need.priority).toBeLessThanOrEqual(8); // Приоритет должен быть <= 8
      });
    },
  );

  createTest(
    {
      name: 'должен обновлять уровень потребности',
      configType: TestConfigType.DATABASE,
      imports: [],
      providers: [
        {
          provide: NeedsService,
          useFactory: () => {
            return new NeedsService(
              dataSource.getRepository(Need),
              dataSource.getRepository(Character),
              new EventEmitter2(),
              tester.get(LogService),
            );
          },
        },
        ...TestConfigurations.addLoggingMocks(),
      ],
    },
    async context => {
      const needsService = context.get(NeedsService);

      const testCharacter = await fixtureManager.createCharacter();
      await needsService.createDefaultNeeds(testCharacter.id);

      const update: INeedUpdate = {
        type: CharacterNeedType.ATTENTION,
        change: 25,
      };

      await needsService.updateNeed(testCharacter.id, update);

      const needs = await needsService.getActiveNeeds(testCharacter.id);
      const attentionNeed = needs.find(need => need.type === CharacterNeedType.ATTENTION);

      expect(attentionNeed).toBeDefined(); // Проверяем, что потребность найдена
      expect(attentionNeed.currentValue).toBe(25); // Уровень должен обновиться на указанное значение
    },
  );

  createTest(
    {
      name: 'должен сбрасывать потребность после удовлетворения',
      configType: TestConfigType.DATABASE,
      imports: [],
      providers: [
        {
          provide: NeedsService,
          useFactory: () => {
            return new NeedsService(
              dataSource.getRepository(Need),
              dataSource.getRepository(Character),
              new EventEmitter2(),
              tester.get(LogService),
            );
          },
        },
        ...TestConfigurations.addLoggingMocks(),
      ],
    },
    async context => {
      const needsService = context.get(NeedsService);

      const testCharacter = await fixtureManager.createCharacter();
      await needsService.createDefaultNeeds(testCharacter.id);

      const update: INeedUpdate = {
        type: CharacterNeedType.CONNECTION,
        change: 80,
      };

      await needsService.updateNeed(testCharacter.id, update);
      await needsService.resetNeed(testCharacter.id, CharacterNeedType.CONNECTION);

      const needs = await needsService.getActiveNeeds(testCharacter.id);
      const connectionNeed = needs.find(need => need.type === CharacterNeedType.CONNECTION);

      expect(connectionNeed).toBeDefined(); // Проверяем, что потребность найдена
      expect(connectionNeed.currentValue).toBe(0); // Уровень должен сброситься до 0 после удовлетворения
    },
  );
});

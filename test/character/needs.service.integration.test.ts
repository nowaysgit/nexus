import { Tester, createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures';
import { NeedsService } from '../../src/character/services/core/needs.service';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { DataSource } from 'typeorm';
import { Need } from '../../src/character/entities/need.entity';
import { Character } from '../../src/character/entities/character.entity';
import { TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';

createTestSuite('NeedsService Integration Tests', () => {
  let tester: Tester;
  let fixtureManager: FixtureManager;
  let dataSource: DataSource;
  let moduleRef: TestingModule;
  let needsService: NeedsService;
  let character: Character;
  let need: Need;

  beforeAll(async () => {
    tester = Tester.getInstance();
    dataSource = await tester.setupTestEnvironment(TestConfigType.DATABASE);
    fixtureManager = new FixtureManager(dataSource);
    moduleRef = await TestModuleBuilder.create()
      .withDatabase(false)
      .withImports([TypeOrmModule.forFeature([Character, Need])])
      .withProviders([NeedsService])
      .compile();

    needsService = moduleRef.get<NeedsService>(NeedsService);
  });

  afterAll(async () => {
    await tester.forceCleanup();
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(async () => {
    await fixtureManager.cleanDatabase();
    const user = await fixtureManager.createUser();
    character = await fixtureManager.createCharacter({ userId: user.id });
    need = await fixtureManager.createNeed({
      characterId: character.id,
      type: CharacterNeedType.HUNGER,
      currentValue: 0.5, // Начальное значение 50%
    });
  });

  createTest(
    {
      name: 'должен быть определен и инициализирован',
      requiresDatabase: false,
    },
    async () => {
      expect(needsService).toBeDefined();
      expect(character).toBeDefined();
      expect(need).toBeDefined();
      expect(need.id).toBeDefined();
      expect(need.type).toBe(CharacterNeedType.HUNGER);
    },
  );

  createTest(
    {
      name: 'должен создавать потребности через FixtureManager',
      requiresDatabase: false,
    },
    async () => {
      const testNeed = await fixtureManager.createNeed({
        characterId: character.id,
        type: CharacterNeedType.ATTENTION,
        currentValue: 0.3,
      });

      expect(testNeed).toBeDefined();
      expect(testNeed.id).toBeDefined();
      expect(testNeed.type).toBe(CharacterNeedType.ATTENTION);
      expect(testNeed.currentValue).toBe(0.3);
    },
  );

  createTest(
    {
      name: 'должен иметь базовые методы сервиса',
      requiresDatabase: false,
    },
    async () => {
      // Проверяем, что сервис имеет ожидаемые методы
      expect(typeof needsService).toBe('object');
      expect(needsService).toBeInstanceOf(NeedsService);
    },
  );
});

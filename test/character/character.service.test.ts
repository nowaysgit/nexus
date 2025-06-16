import { DataSource, Repository } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';

import { createTestSuite, createTest } from '../../lib/tester';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';

import { CharacterService } from '../../src/character/services/character.service';
import { Character, CharacterGender } from '../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';

createTestSuite('CharacterService Integration Tests', () => {
  let fixtureManager: FixtureManager;
  let moduleRef: import('@nestjs/testing').TestingModule | null = null;
  let dataSource: DataSource;
  let characterService: CharacterService;

  beforeEach(async () => {
    moduleRef = await TestModuleBuilder.create()
      .withImports([TypeOrmModule.forFeature([Character])])
      .withProviders([CharacterService])
      .withRequiredMocks()
      .compile();

    dataSource = moduleRef.get<DataSource>(DataSource);
    fixtureManager = new FixtureManager(dataSource);
    characterService = moduleRef.get<CharacterService>(CharacterService);

    await fixtureManager.cleanDatabase();
  });

  afterEach(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  createTest(
    {
      name: 'should create a character',
    },
    async () => {
      const characterServiceInstance = characterService;
      const user = await fixtureManager.createUser({});

      const characterData = {
        name: 'Test Character',
        fullName: 'Test Character Full Name',
        age: 25,
        gender: CharacterGender.FEMALE,
        archetype: CharacterArchetype.HERO,
        biography: 'Test biography',
        appearance: 'Test appearance',
        personality: {
          traits: ['kind', 'smart'],
          hobbies: ['reading', 'gaming'],
          fears: ['heights', 'spiders'],
          values: ['honesty', 'loyalty'],
          musicTaste: ['rock', 'pop'],
          strengths: ['creativity', 'empathy'],
          weaknesses: ['impatience', 'stubbornness'],
        },
        user,
      };

      const result = await characterServiceInstance.create(characterData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toEqual(characterData.name);

      // Use fixtureManager to get the repository
      const characterRepo: Repository<Character> = fixtureManager.getRepository(Character);
      const found = await characterRepo.findOneBy({ id: result.id });

      expect(found).not.toBeNull();
      if (found) {
        expect(found.name).toBe('Test Character');
      }
    },
  );

  createTest(
    {
      name: 'should find a character by ID',
    },
    async () => {
      const user = await fixtureManager.createUser({});
      const character = await fixtureManager.createCharacter({ user });
      const characterServiceInstance = characterService;
      const result = await characterServiceInstance.findOneById(character.id);

      expect(result).toBeDefined();
      expect(result?.id).toEqual(character.id);
    },
  );
});

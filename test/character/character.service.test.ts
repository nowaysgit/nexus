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
      requiresDatabase: true,
    },
    async () => {
      const characterServiceInstance = characterService;
      // Create user with explicit UUID format
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
      expect(result.userId).toEqual(user.id); // Check that userId is correctly set

      // Use fixtureManager to get the repository
      const characterRepo: Repository<Character> = fixtureManager.getRepository(Character);
      const found = await characterRepo.findOneBy({ id: result.id });

      expect(found).not.toBeNull();
      if (found) {
        expect(found.name).toBe('Test Character');
        expect(found.userId).toBe(user.id); // Verify userId is a string (UUID)
      }
    },
  );

  createTest(
    {
      name: 'should find a character by ID',
      requiresDatabase: true,
    },
    async () => {
      const user = await fixtureManager.createUser({});
      const character = await fixtureManager.createCharacter({ user });
      const characterServiceInstance = characterService;
      const result = await characterServiceInstance.findOneById(character.id);

      expect(result).toBeDefined();
      expect(result?.id).toEqual(character.id);
      expect(result?.userId).toEqual(user.id); // Verify userId is correctly set
    },
  );

  createTest(
    {
      name: 'should find characters by user ID',
      requiresDatabase: true,
    },
    async () => {
      const user = await fixtureManager.createUser({});
      const _character1 = await fixtureManager.createCharacter({ user, name: 'Character 1' });
      const _character2 = await fixtureManager.createCharacter({ user, name: 'Character 2' });

      const characters = await characterService.findByUserId(user.id);

      expect(characters).toHaveLength(2);
      expect(characters.map(c => c.name).sort()).toEqual(['Character 1', 'Character 2'].sort());
      expect(characters[0].userId).toEqual(user.id);
      expect(characters[1].userId).toEqual(user.id);
    },
  );
});

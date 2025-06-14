import { createTestSuite, createTest, TestConfigType, Tester } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures';
import { CharacterService } from '../../src/character/services/character.service';
import { Character, CharacterGender } from '../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';

createTestSuite('CharacterService Integration Tests', () => {
  let tester: Tester;
  let fixtureManager: FixtureManager;

  beforeAll(async () => {
    tester = Tester.getInstance();
    const dataSource = await tester.setupTestEnvironment(TestConfigType.DATABASE);
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
      name: 'should create a character',
      configType: TestConfigType.DATABASE,
    },
    async context => {
      const characterService = context.get(CharacterService);
      const user = await fixtureManager.createUser({});

      // Ensure userId is a number
      const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;

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
        userId: userId,
      };

      const result = await characterService.create(characterData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toEqual(characterData.name);

      // Use fixtureManager to get the repository
      const characterRepo = fixtureManager.getRepository(Character);
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
      configType: TestConfigType.DATABASE,
    },
    async context => {
      const user = await fixtureManager.createUser({});
      const character = await fixtureManager.createCharacter({ user });
      const characterService = context.get(CharacterService);
      const result = await characterService.findOneById(character.id);

      expect(result).toBeDefined();
      expect(result?.id).toEqual(character.id);
    },
  );
});

import { Test, TestingModule } from '@nestjs/testing';
import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { Character, CharacterGender } from '../../src/character/entities/character.entity';
import { Dialog } from '../../src/dialog/entities/dialog.entity';
import { CharacterService } from '../../src/character/services/character.service';
import { DialogService } from '../../src/dialog/services/dialog.service';
import { UserService } from '../../src/user/services/user.service';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';

createTestSuite('ID Types Compatibility Integration Tests', () => {
  let app: INestApplication;
  let characterService: CharacterService;
  let dialogService: DialogService;
  let userService: UserService;
  let fixtureManager: FixtureManager;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    characterService = app.get<CharacterService>(CharacterService);
    dialogService = app.get<DialogService>(DialogService);
    userService = app.get<UserService>(UserService);
    fixtureManager = new FixtureManager(dataSource);
  });

  beforeEach(async () => {
    await fixtureManager.cleanDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  createTest(
    {
      name: 'должен корректно работать с числовым ID пользователя',
      configType: TestConfigType.INTEGRATION,
    },
    async () => {
      const user = await fixtureManager.createUser({
        id: 'a1b2c3d4-e5f6-7890-abcd-000000012345',
        email: 'numeric-id@example.com',
        password: 'password123',
        username: 'Numeric ID User',
        telegramId: '12345',
      });
      expect(user).toBeDefined();

      const character = await fixtureManager.createCharacter({
        name: 'Test Character',
        userId: 12345,
        age: 25,
        gender: CharacterGender.FEMALE,
        archetype: CharacterArchetype.CAREGIVER,
        biography: 'Test biography',
        appearance: 'Test appearance',
        personality: {
          traits: ['kind', 'smart'],
          hobbies: ['reading', 'music'],
          fears: ['heights'],
          values: ['honesty'],
          musicTaste: ['rock', 'jazz'],
          strengths: ['intelligence'],
          weaknesses: ['impatience'],
        },
      });
      expect(character).toBeDefined();
      expect(character.userId).toBe(12345);

      const dialog = await fixtureManager.createDialog({
        user: user,
        character: character,
        userId: 12345,
        characterId: character.id,
      });
      expect(dialog).toBeDefined();
      expect(dialog.userId).toBe(12345);
      expect(dialog.characterId).toBe(character.id);

      const foundCharacters = await characterService.findByUserId(12345);
      expect(foundCharacters).toBeDefined();
      expect(foundCharacters.length).toBe(1);
      expect(foundCharacters[0].id).toBe(character.id);

      const foundDialogs = await dialogService.getUserDialogs(user.telegramId);
      expect(foundDialogs).toBeDefined();
      expect(foundDialogs.length).toBe(1);
      expect(foundDialogs[0].id).toBe(dialog.id);
    },
  );

  createTest(
    {
      name: 'должен корректно конвертировать типы ID с помощью FixtureManager',
      configType: TestConfigType.INTEGRATION,
    },
    async () => {
      const numericId = 12345;
      const uuidFromNumeric = fixtureManager.numericToUuid(numericId);
      expect(uuidFromNumeric).toBeDefined();
      expect(typeof uuidFromNumeric).toBe('string');
      expect(uuidFromNumeric.length).toBe(36);

      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const numericFromUuid = fixtureManager.uuidToNumeric(uuid);
      expect(numericFromUuid).toBeDefined();
      expect(typeof numericFromUuid).toBe('number');

      const stringResult = fixtureManager.ensureIdFormat(12345, 'string');
      expect(stringResult).toBeDefined();
      expect(typeof stringResult).toBe('string');

      const numberResult = fixtureManager.ensureIdFormat(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'number',
      );
      expect(numberResult).toBeDefined();
      expect(typeof numberResult).toBe('number');
    },
  );

  createTest(
    {
      name: 'должен корректно работать при смешанном использовании типов ID',
      configType: TestConfigType.INTEGRATION,
    },
    async () => {
      const user1 = await fixtureManager.createUser({
        id: 'a1b2c3d4-e5f6-7890-abcd-000000012345',
        email: 'numeric-id@example.com',
        password: 'password123',
        username: 'Numeric ID User',
        telegramId: '12345',
      });

      const user2 = await fixtureManager.createUser({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        email: 'string-id@example.com',
        password: 'password123',
        username: 'String ID User',
        telegramId: '67890',
      });

      const character1 = await fixtureManager.createCharacter({
        name: 'Numeric User Character',
        userId: 12345,
        age: 25,
        gender: CharacterGender.FEMALE,
        archetype: CharacterArchetype.CAREGIVER,
        biography: 'Test biography',
        appearance: 'Test appearance',
        personality: {
          traits: ['kind', 'smart'],
          hobbies: ['reading', 'music'],
          fears: ['heights'],
          values: ['honesty'],
          musicTaste: ['rock', 'jazz'],
          strengths: ['intelligence'],
          weaknesses: ['impatience'],
        },
      });
      const character2 = await fixtureManager.createCharacter({
        name: 'String User Character',
        user: user2,
        age: 30,
        gender: CharacterGender.MALE,
        archetype: CharacterArchetype.EXPLORER,
        biography: 'Another test biography',
        appearance: 'Another test appearance',
        personality: {
          traits: ['brave', 'curious'],
          hobbies: ['hiking', 'photography'],
          fears: ['spiders'],
          values: ['freedom'],
          musicTaste: ['indie', 'folk'],
          strengths: ['adaptability'],
          weaknesses: ['recklessness'],
        },
      });

      expect(character1).toBeDefined();
      expect(character1.userId).toBe(12345);
      expect(character2).toBeDefined();
      expect(character2.userId).toBe(user2.id);

      const foundCharacters1 = await characterService.findByUserId(12345);
      expect(foundCharacters1.length).toBe(1);
      expect(foundCharacters1[0].id).toBe(character1.id);
      // We cannot test findByUserId with user2 because user2.id is a string, and the service expects a number.
    },
  );
});

import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';

import { createTest } from '../../lib/tester';
import { createTestDataSource } from '../../lib/tester/utils/data-source';

import { CharacterService } from '../../src/character/services/character.service';
import { Character, CharacterGender } from '../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { LogService } from '../../src/logging/log.service';
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';

// Пропускаем все тесты при использовании SQLite
if (process.env.USE_SQLITE === 'true') {
  describe('CharacterService Integration Tests', () => {
    it('SQLite tests skipped', () => {
      console.log('Пропускаем CharacterService Integration Tests при использовании SQLite');
    });
  });
} else {
  describe('CharacterService Unit Tests', () => {
    let moduleRef: TestingModule;
    let characterService: CharacterService;

    beforeEach(async () => {
      // Устанавливаем переменную окружения для unit тестов
      process.env.NODE_ENV = 'test';
      delete process.env.INTEGRATION_TEST;

      // Создаем мок DataSource
      const mockDataSource = await createTestDataSource();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CharacterService,
          {
            provide: getRepositoryToken(Character),
            useValue: mockDataSource.getRepository(Character),
          },
          {
            provide: LogService,
            useClass: MockLogService,
          },
        ],
      }).compile();

      moduleRef = module;
      characterService = module.get<CharacterService>(CharacterService);
    });

    afterEach(async () => {
      if (moduleRef) {
        await moduleRef.close();
      }
      // Очищаем глобальное хранилище моков после каждого теста
      (global as any).__mockStorage = {};
    });

    createTest(
      {
        name: 'should create a character',
      },
      async () => {
        const characterServiceInstance = characterService;
        // Create mock user
        const user = { id: 'test-user-id-123' };

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
      },
    );

    createTest(
      {
        name: 'should find a character by ID',
      },
      async () => {
        const user = { id: 'test-user-id-456' };

        // First create a character
        const character = await characterService.create({
          name: 'Test Character Find',
          fullName: 'Test Character Find Full Name',
          age: 30,
          gender: CharacterGender.MALE,
          archetype: CharacterArchetype.HERO,
          biography: 'Test biography for find',
          appearance: 'Test appearance for find',
          personality: {
            traits: ['brave', 'smart'],
            hobbies: ['reading'],
            fears: ['darkness'],
            values: ['justice'],
            musicTaste: ['classical'],
            strengths: ['leadership'],
            weaknesses: ['pride'],
          },
          user,
        });

        const result = await characterService.findOneById(character.id);

        expect(result).toBeDefined();
        expect(result?.id).toEqual(character.id);
        expect(result?.userId).toEqual(user.id); // Verify userId is correctly set
      },
    );

    createTest(
      {
        name: 'should find characters by user ID',
      },
      async () => {
        const user = { id: 'test-user-id-789' };

        // Create first character
        await characterService.create({
          name: 'Character 1',
          fullName: 'Character 1 Full Name',
          age: 25,
          gender: CharacterGender.FEMALE,
          archetype: CharacterArchetype.HERO,
          biography: 'Biography 1',
          appearance: 'Appearance 1',
          personality: {
            traits: ['kind'],
            hobbies: ['reading'],
            fears: ['heights'],
            values: ['honesty'],
            musicTaste: ['pop'],
            strengths: ['creativity'],
            weaknesses: ['impatience'],
          },
          user,
        });

        // Create second character
        await characterService.create({
          name: 'Character 2',
          fullName: 'Character 2 Full Name',
          age: 30,
          gender: CharacterGender.MALE,
          archetype: CharacterArchetype.ANTIHERO,
          biography: 'Biography 2',
          appearance: 'Appearance 2',
          personality: {
            traits: ['cunning'],
            hobbies: ['chess'],
            fears: ['failure'],
            values: ['power'],
            musicTaste: ['rock'],
            strengths: ['intelligence'],
            weaknesses: ['arrogance'],
          },
          user,
        });

        const characters = await characterService.findByUserId(user.id);

        expect(characters).toHaveLength(2);
        expect(characters.map(c => c.name).sort()).toEqual(['Character 1', 'Character 2'].sort());
        expect(characters[0].userId).toEqual(user.id);
        expect(characters[1].userId).toEqual(user.id);
      },
    );
  });
}

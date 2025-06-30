import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../../lib/tester/utils/data-source';
import { ALL_TEST_ENTITIES } from '../../lib/tester/entities';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import {
  MemoryImportance,
  MemoryImportanceLevel,
} from '../../src/character/entities/character-memory.entity';
import { MotivationIntensity } from '../../src/character/entities/character-motivation.entity';

describe('FixtureManager Optimization Tests', () => {
  let dataSource: DataSource;
  let fixtureManager: FixtureManager;

  beforeAll(async () => {
    try {
      // Используем PostgreSQL для тестов
      dataSource = await createTestDataSource();
      console.log('Используется PostgreSQL для тестов FixtureManager Optimization');

      fixtureManager = new FixtureManager(dataSource);

      // Проверяем, что методы существуют
      expect(typeof fixtureManager.createBatchUserCharacterDialog).toBe('function');
      expect(typeof fixtureManager.createOptimizedCharacterSetup).toBe('function');
      expect(typeof fixtureManager.createBatchTestData).toBe('function');
      expect(typeof fixtureManager.cleanDatabase).toBe('function');
    } catch (error) {
      console.error('Ошибка при инициализации тестов FixtureManager Optimization:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Закрываем соединение
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Очищаем базу данных перед каждым тестом
    await fixtureManager.cleanDatabase();
  });

  describe('Оптимизированное создание тестовых данных', () => {
    it('должен создавать пользователей и персонажей базовыми методами', async () => {
      // Создаем пользователей и персонажей базовыми методами
      const users = [];
      const characters = [];

      for (let i = 0; i < 2; i++) {
        const user = await fixtureManager.createUser({
          telegramId: `test_user_${i}`,
          username: `testuser${i}`,
          firstName: `Test${i}`,
          lastName: `User${i}`,
        });
        users.push(user);

        const character = await fixtureManager.createCharacter({
          userId: user.id,
          name: `Test Character ${i}`,
        });
        characters.push(character);
      }

      // Проверяем результаты
      expect(users.length).toBe(2);
      expect(characters.length).toBe(2);
      expect(characters[0].userId).toBe(users[0].id);
      expect(characters[1].userId).toBe(users[1].id);
    });

    it('должен создавать персонажа с потребностями и мотивациями', async () => {
      // Создаем пользователя и персонажа
      const user = await fixtureManager.createUser({
        telegramId: 'optimization_user',
        username: 'optimizationuser',
        firstName: 'Optimization',
        lastName: 'User',
      });

      const character = await fixtureManager.createCharacter({
        userId: user.id,
        name: 'Optimization Character',
      });

      // Создаем потребности
      const needs = [];
      for (let i = 0; i < 3; i++) {
        const need = await fixtureManager.createNeed({
          characterId: character.id,
          type: CharacterNeedType.HUNGER,
          currentValue: 50 + i * 10,
        });
        needs.push(need);
      }

      // Создаем мотивации
      const motivations = [];
      for (let i = 0; i < 2; i++) {
        const motivation = await fixtureManager.createMotivation(character.id, {
          relatedNeed: CharacterNeedType.HUNGER,
          intensity: MotivationIntensity.MODERATE,
          description: `Test motivation ${i}`,
        });
        motivations.push(motivation);
      }

      // Проверяем результаты
      expect(user).toBeDefined();
      expect(character).toBeDefined();
      expect(needs.length).toBe(3);
      expect(motivations.length).toBe(2);
      expect(character.userId).toBe(user.id);
      expect(needs[0].characterId).toBe(character.id);
      expect(motivations[0].characterId).toBe(character.id);
    });

    it('должен эффективно очищать базу данных', async () => {
      // Создаем тестовые данные
      const user = await fixtureManager.createUser({
        telegramId: 'cleanup_user',
        username: 'cleanupuser',
        firstName: 'Cleanup',
        lastName: 'User',
      });

      const character = await fixtureManager.createCharacter({
        userId: user.id,
        name: 'Cleanup Character',
      });

      // Засекаем время выполнения очистки
      const startTime = Date.now();
      await fixtureManager.cleanDatabase();
      const endTime = Date.now();

      // Проверяем, что очистка выполнилась быстро (менее 5 секунд)
      const cleanupTime = endTime - startTime;
      expect(cleanupTime).toBeLessThan(5000);

      console.log(`Очистка базы данных заняла ${cleanupTime}ms`);
    });

    it('должен создавать воспоминания для персонажа', async () => {
      // Создаем пользователя и персонажа
      const user = await fixtureManager.createUser({
        telegramId: 'memory_user',
        username: 'memoryuser',
        firstName: 'Memory',
        lastName: 'User',
      });

      const character = await fixtureManager.createCharacter({
        userId: user.id,
        name: 'Memory Character',
      });

      // Создаем воспоминания
      const memories = [];
      for (let i = 0; i < 5; i++) {
        const memory = await fixtureManager.createMemory(character.id, {
          content: `Test memory ${i}`,
          importance: MemoryImportanceLevel.AVERAGE,
        });
        memories.push(memory);
      }

      // Проверяем результаты
      expect(memories.length).toBe(5);
      expect(memories[0].characterId).toBe(character.id);
      expect(memories[0].content).toContain('Test memory');
    });
  });
});

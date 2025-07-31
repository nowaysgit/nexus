import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { createTestDataSource } from '../../lib/tester/utils/data-source';
import { DataSource } from 'typeorm';

describe('Batch Data Creation Tests', () => {
  let dataSource: DataSource;
  let fixtureManager: FixtureManager;

  beforeAll(async () => {
    try {
      // Создаем тестовый DataSource для PostgreSQL
      dataSource = await createTestDataSource();
      console.log('Используется PostgreSQL для тестов пакетного создания данных');

      fixtureManager = new FixtureManager(dataSource);
    } catch (error) {
      console.error('Ошибка при инициализации тестов:', error);
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

  describe('Пакетное создание тестовых данных', () => {
    it('Метод createBatchUserCharacterDialog должен создавать связанные записи', async () => {
      // Создаем 2 пользователя, по 2 персонажа на каждого, по 2 диалога на персонажа, по 3 сообщения в диалоге
      const result = await fixtureManager.createBatchUserCharacterDialog({
        usersCount: 2,
        charactersPerUser: 2,
        dialogsPerCharacter: 2,
        messagesPerDialog: 3,
      });

      // Проверяем результаты
      expect(result.users.length).toBe(2);
      expect(result.characters.length).toBe(4); // 2 пользователя * 2 персонажа
      expect(result.dialogs.length).toBe(8); // 4 персонажа * 2 диалога
      expect(result.messages.length).toBe(24); // 8 диалогов * 3 сообщения

      // Проверяем связи между объектами
      const firstCharacter = result.characters[0];
      const firstUser = result.users[0];
      expect(firstCharacter.userId).toBe(firstUser.id);

      const firstDialog = result.dialogs[0];
      expect(firstDialog.characterId).toBe(result.characters[0].id);

      const firstMessage = result.messages[0];
      expect(firstMessage.dialogId).toBe(result.dialogs[0].id);
    });

    it('Метод createBatchTestData должен создавать все типы данных', async () => {
      // Создаем полный набор тестовых данных
      const result = await fixtureManager.createBatchTestData({
        usersCount: 1,
        charactersPerUser: 1,
        needsPerCharacter: 2,
        motivationsPerCharacter: 2,
        actionsPerCharacter: 2,
        dialogsPerCharacter: 1,
        messagesPerDialog: 2,
        memoriesPerCharacter: 3,
      });

      // Проверяем результаты
      expect(result.users.length).toBe(1);
      expect(result.characters.length).toBe(1);
      expect(result.needs.length).toBe(2);
      expect(result.motivations.length).toBe(2);
      expect(result.actions.length).toBe(2);
      expect(result.dialogs.length).toBe(1);
      expect(result.messages.length).toBe(2);
      expect(result.memories.length).toBe(3);

      // Проверяем связи между объектами
      const user = result.users[0];
      const character = result.characters[0];
      expect(character.userId).toBe(user.id);

      const need = result.needs[0];
      expect(need.characterId).toBe(character.id);

      const motivation = result.motivations[0];
      expect(motivation.characterId).toBe(character.id);

      const action = result.actions[0];
      expect(action.characterId).toBe(character.id);

      const dialog = result.dialogs[0];
      expect(dialog.characterId).toBe(character.id);
      expect(dialog.userId).toBe(user.id);

      const message = result.messages[0];
      expect(message.dialogId).toBe(dialog.id);

      const memory = result.memories[0];
      expect(memory.characterId).toBe(character.id);
    });

    it('Метод createOptimizedCharacterSetup должен создавать персонажа со всеми связанными данными', async () => {
      // Создаем персонажа с потребностями, мотивациями, действиями и воспоминаниями
      const result = await fixtureManager.createOptimizedCharacterSetup({
        needsCount: 3,
        motivationsCount: 2,
        actionsCount: 2,
        memoriesCount: 4,
      });

      // Проверяем результаты
      expect(result.user).toBeDefined();
      expect(result.character).toBeDefined();
      expect(result.needs.length).toBe(3);
      expect(result.motivations.length).toBe(2);
      expect(result.actions.length).toBe(2);
      expect(result.memories.length).toBe(4);

      // Проверяем связи между объектами
      expect(result.character.userId).toBe(result.user.id);

      const firstNeed = result.needs[0];
      expect(firstNeed.characterId).toBe(result.character.id);

      const firstMotivation = result.motivations[0];
      expect(firstMotivation.characterId).toBe(result.character.id);

      const firstAction = result.actions[0];
      expect(firstAction.characterId).toBe(result.character.id);

      const firstMemory = result.memories[0];
      expect(firstMemory.characterId).toBe(result.character.id);
    });
  });
});

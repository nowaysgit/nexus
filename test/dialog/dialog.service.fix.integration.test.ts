import { createTestSuite, createTest } from '../../lib/tester';
import { DialogService, DialogMessageType } from '../../src/dialog/services/dialog.service';
import { Message } from '../../src/dialog/entities/message.entity';
import { DialogModule } from '../../src/dialog/dialog.module';
import { CacheModule } from '../../src/cache/cache.module';
import { TestConfigType } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { MessageQueueModule } from '../../src/message-queue/message-queue.module';
import { ValidationModule } from '../../src/validation/validation.module';
import { v4 as uuidv4 } from 'uuid';

// Создаем расширенный мок для UserService
const extendedMockUserService = {
  getUserIdByTelegramId: jest.fn(),
  getUserById: jest.fn(),
  getUserByTelegramId: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
};

createTestSuite('DialogService Integration Tests', () => {
  createTest(
    {
      name: 'должен быть определен',
      configType: TestConfigType.INTEGRATION,
      requiresDatabase: true,
      imports: [DialogModule, CacheModule, MessageQueueModule, ValidationModule],
      providers: [
        {
          provide: 'UserService',
          useValue: extendedMockUserService,
        },
      ],
    },
    async testModule => {
      const dialogService = testModule.get<DialogService>(DialogService);
      expect(dialogService).toBeDefined();
    },
  );

  createTest(
    {
      name: 'должен создавать диалог',
      configType: TestConfigType.INTEGRATION,
      requiresDatabase: true,
      imports: [DialogModule, CacheModule, MessageQueueModule, ValidationModule],
      providers: [
        {
          provide: 'UserService',
          useValue: extendedMockUserService,
        },
      ],
    },
    async testModule => {
      // Устанавливаем тестовый режим
      process.env.NODE_ENV = 'test';

      const dialogService = testModule.get<DialogService>(DialogService);
      const fixtureManager = new FixtureManager(testModule.get('DATA_SOURCE'));

      // Очищаем базу данных перед тестом
      await fixtureManager.cleanDatabase();

      // Создаем тестового пользователя и персонажа
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({ user });

      // Используем UUID формат для telegramId в тестах
      const telegramId = uuidv4();

      // Выводим информацию для отладки
      console.log('User ID:', user.id, 'Type:', typeof user.id);
      console.log('Character ID:', character.id, 'Type:', typeof character.id);

      try {
        // Создаем диалог через фикстуры
        const dialog = await fixtureManager.createDialog({
          telegramId: telegramId,
          characterId: character.id,
          userId: Number(user.id),
          character: character,
          isActive: true,
          lastInteractionDate: new Date(),
        });

        // Проверяем результат
        expect(dialog).toBeDefined();
        expect(dialog).not.toBeNull();
        expect(dialog.telegramId).toBe(telegramId);
        expect(dialog.characterId).toBe(character.id);
        expect(dialog.isActive).toBe(true);

        // Теперь проверяем, что диалог можно получить через сервис
        const retrievedDialog = await dialogService.getDialogById(dialog.id);
        expect(retrievedDialog).toBeDefined();
        expect(retrievedDialog).not.toBeNull();
        expect(retrievedDialog.id).toBe(dialog.id);
      } catch (error) {
        console.error('Error in test:', error instanceof Error ? error.message : String(error));
        throw error;
      }
    },
  );

  createTest(
    {
      name: 'должен сохранять сообщения пользователя и персонажа',
      configType: TestConfigType.INTEGRATION,
      requiresDatabase: true,
      imports: [DialogModule, CacheModule, MessageQueueModule, ValidationModule],
      providers: [
        {
          provide: 'UserService',
          useValue: extendedMockUserService,
        },
      ],
    },
    async testModule => {
      // Устанавливаем тестовый режим
      process.env.NODE_ENV = 'test';

      const dialogService = testModule.get<DialogService>(DialogService);
      const fixtureManager = new FixtureManager(testModule.get('DATA_SOURCE'));

      // Очищаем базу данных перед тестом
      await fixtureManager.cleanDatabase();

      // Создаем тестового пользователя и персонажа
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({ user });

      // Используем UUID формат для telegramId в тестах
      const telegramId = uuidv4();
      const userMessageContent = 'Привет, это тестовое сообщение!';
      const characterMessageContent = 'Привет, я получил твое сообщение!';

      try {
        // Создаем диалог через фикстуры
        const dialog = await fixtureManager.createDialog({
          telegramId: telegramId,
          characterId: character.id,
          userId: Number(user.id),
          character: character,
          isActive: true,
          lastInteractionDate: new Date(),
        });

        // Проверяем, что диалог создан успешно
        expect(dialog).toBeDefined();
        expect(dialog).not.toBeNull();

        // Сохраняем сообщение пользователя через сервис
        const userMessage = await dialogService.createMessage({
          dialogId: dialog.id,
          content: userMessageContent,
          type: DialogMessageType.USER,
        });

        expect(userMessage).toBeDefined();
        expect(userMessage.content).toBe(userMessageContent);
        expect(userMessage.isFromUser).toBe(true);

        // Сохраняем сообщение персонажа
        const characterMessage = await dialogService.saveCharacterMessageDirect(
          dialog.id,
          characterMessageContent,
        );

        expect(characterMessage).toBeDefined();
        expect(characterMessage.content).toBe(characterMessageContent);
        expect(characterMessage.isFromUser).toBe(false);
      } catch (error) {
        console.error('Error in test:', error instanceof Error ? error.message : String(error));
        throw error;
      }
    },
  );

  createTest(
    {
      name: 'должен получать историю диалога',
      configType: TestConfigType.INTEGRATION,
      requiresDatabase: true,
      imports: [DialogModule, CacheModule, MessageQueueModule, ValidationModule],
      providers: [
        {
          provide: 'UserService',
          useValue: extendedMockUserService,
        },
      ],
    },
    async testModule => {
      // Устанавливаем тестовый режим
      process.env.NODE_ENV = 'test';

      const dialogService = testModule.get<DialogService>(DialogService);
      const fixtureManager = new FixtureManager(testModule.get('DATA_SOURCE'));

      // Очищаем базу данных перед тестом
      await fixtureManager.cleanDatabase();

      // Создаем тестового пользователя и персонажа
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({ user });

      // Используем UUID формат для telegramId в тестах
      const telegramId = uuidv4();

      try {
        // Создаем диалог через фикстуры
        const dialog = await fixtureManager.createDialog({
          telegramId: telegramId,
          characterId: character.id,
          userId: Number(user.id),
          character: character,
          isActive: true,
          lastInteractionDate: new Date(),
        });

        // Проверяем, что диалог создан успешно
        expect(dialog).toBeDefined();
        expect(dialog).not.toBeNull();

        // Добавляем несколько сообщений
        const _userMessage1 = await dialogService.createMessage({
          dialogId: dialog.id,
          content: 'Сообщение 1',
          type: DialogMessageType.USER,
        });

        const _characterMessage = await dialogService.saveCharacterMessageDirect(
          dialog.id,
          'Ответ 1',
        );

        const _userMessage2 = await dialogService.createMessage({
          dialogId: dialog.id,
          content: 'Сообщение 2',
          type: DialogMessageType.USER,
        });

        // Получаем историю диалога
        const result = await dialogService.getDialogMessages(dialog.id, 1, 10);

        // В тестовом режиме getDialogMessages возвращает массив
        expect(Array.isArray(result)).toBe(true);
        const messages = result as Message[];
        expect(messages.length).toBe(3);

        // Проверяем, что сообщения есть в списке, без привязки к конкретному порядку
        const messageContents = messages.map(m => m.content);
        expect(messageContents).toContain('Сообщение 1');
        expect(messageContents).toContain('Ответ 1');
        expect(messageContents).toContain('Сообщение 2');
      } catch (error) {
        console.error('Error in test:', error instanceof Error ? error.message : String(error));
        throw error;
      }
    },
  );

  createTest(
    {
      name: 'должен получать диалог по ID',
      configType: TestConfigType.INTEGRATION,
      requiresDatabase: true,
      imports: [DialogModule, CacheModule, MessageQueueModule, ValidationModule],
      providers: [
        {
          provide: 'UserService',
          useValue: extendedMockUserService,
        },
      ],
    },
    async testModule => {
      // Устанавливаем тестовый режим
      process.env.NODE_ENV = 'test';

      const dialogService = testModule.get<DialogService>(DialogService);
      const fixtureManager = new FixtureManager(testModule.get('DATA_SOURCE'));

      // Очищаем базу данных перед тестом
      await fixtureManager.cleanDatabase();

      // Создаем тестового пользователя и персонажа
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({ user });

      // Используем UUID формат для telegramId в тестах
      const telegramId = uuidv4();

      try {
        // Создаем диалог через фикстуры
        const dialog = await fixtureManager.createDialog({
          telegramId: telegramId,
          characterId: character.id,
          userId: Number(user.id),
          character: character,
          isActive: true,
          lastInteractionDate: new Date(),
        });

        // Проверяем, что диалог создан успешно
        expect(dialog).toBeDefined();
        expect(dialog).not.toBeNull();

        // Получаем диалог по ID
        const retrievedDialog = await dialogService.getDialogById(dialog.id);

        // Проверяем результат
        expect(retrievedDialog).toBeDefined();
        expect(retrievedDialog).not.toBeNull();
        expect(retrievedDialog.id).toBe(dialog.id);
        expect(retrievedDialog.telegramId).toBe(telegramId);
        expect(retrievedDialog.characterId).toBe(character.id);
      } catch (error) {
        console.error('Error in test:', error instanceof Error ? error.message : String(error));
        throw error;
      }
    },
  );
});

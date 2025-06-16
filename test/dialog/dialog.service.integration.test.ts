import { createTestSuite, createTest } from '../../lib/tester';
import { DialogService } from '../../src/dialog/services/dialog.service';
import { Message } from '../../src/dialog/entities/message.entity';
import { DialogModule } from '../../src/dialog/dialog.module';
import { CacheModule } from '../../src/cache/cache.module';
import { TestConfigType } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { MessageQueueModule } from '../../src/message-queue/message-queue.module';
import { ValidationModule } from '../../src/validation/validation.module';

// Создаем расширенный мок для UserService
const extendedMockUserService = {
  getUserIdByTelegramId: jest.fn(),
  getUserById: jest.fn(),
  getUserByTelegramId: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
};

// Интерфейс для типизации UserService
interface IUserService {
  getUserIdByTelegramId: jest.Mock;
  getUserById: jest.Mock;
  getUserByTelegramId: jest.Mock;
  createUser: jest.Mock;
  updateUser: jest.Mock;
  deleteUser: jest.Mock;
}

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
      const userService = testModule.get<IUserService>('UserService');

      // Очищаем базу данных перед тестом
      await fixtureManager.cleanDatabase();

      // Создаем тестового пользователя и персонажа
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({ user });

      // Используем числовой формат для telegramId в тестах
      const telegramId = '123456789';

      // Настраиваем мок для getUserIdByTelegramId
      userService.getUserIdByTelegramId.mockResolvedValue(user.id);
      userService.getUserById.mockResolvedValue(user);

      // Вызываем метод сервиса
      const result = await dialogService.getOrCreateDialog(telegramId, character.id);

      // Проверяем результат
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(result.telegramId).toBe(telegramId);
      expect(result.characterId).toBe(character.id);
      expect(result.isActive).toBe(true);
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
      const userService = testModule.get<IUserService>('UserService');

      // Очищаем базу данных перед тестом
      await fixtureManager.cleanDatabase();

      // Создаем тестового пользователя и персонажа
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({ user });

      // Используем числовой формат для telegramId в тестах
      const telegramId = '123456789';
      const userMessageContent = 'Привет, это тестовое сообщение!';
      const characterMessageContent = 'Привет, я получил твое сообщение!';

      // Настраиваем мок для getUserIdByTelegramId
      userService.getUserIdByTelegramId.mockResolvedValue(user.id);
      userService.getUserById.mockResolvedValue(user);

      // Создаем диалог
      const dialog = await dialogService.getOrCreateDialog(telegramId, character.id);

      // Проверяем, что диалог создан успешно
      expect(dialog).toBeDefined();
      expect(dialog).not.toBeNull();

      // Сохраняем сообщение пользователя
      const userMessage = await dialogService.saveUserMessage(
        telegramId,
        character.id,
        userMessageContent,
      );

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
      const userService = testModule.get<IUserService>('UserService');

      // Очищаем базу данных перед тестом
      await fixtureManager.cleanDatabase();

      // Создаем тестового пользователя и персонажа
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({ user });

      // Используем числовой формат для telegramId в тестах
      const telegramId = '123456789';

      // Настраиваем мок для getUserIdByTelegramId
      userService.getUserIdByTelegramId.mockResolvedValue(user.id);
      userService.getUserById.mockResolvedValue(user);

      // Создаем диалог и сообщения
      const dialog = await dialogService.getOrCreateDialog(telegramId, character.id);

      // Проверяем, что диалог создан успешно
      expect(dialog).toBeDefined();
      expect(dialog).not.toBeNull();

      // Добавляем несколько сообщений
      await dialogService.saveUserMessage(telegramId, character.id, 'Сообщение 1');
      await dialogService.saveCharacterMessageDirect(dialog.id, 'Ответ 1');
      await dialogService.saveUserMessage(telegramId, character.id, 'Сообщение 2');

      // Получаем историю диалога
      const result = await dialogService.getDialogMessages(dialog.id, 1, 10);

      // В тестовом режиме getDialogMessages возвращает массив
      expect(Array.isArray(result)).toBe(true);
      const messages = result as Message[];
      expect(messages.length).toBe(3);

      // Проверяем содержимое сообщений
      expect(messages[0].content).toBe('Сообщение 1');
      expect(messages[1].content).toBe('Ответ 1');
      expect(messages[2].content).toBe('Сообщение 2');
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
      const userService = testModule.get<IUserService>('UserService');

      // Очищаем базу данных перед тестом
      await fixtureManager.cleanDatabase();

      // Создаем тестового пользователя и персонажа
      const user = await fixtureManager.createUser();
      const character = await fixtureManager.createCharacter({ user });

      // Используем числовой формат для telegramId в тестах
      const telegramId = '123456789';

      // Настраиваем мок для getUserIdByTelegramId
      userService.getUserIdByTelegramId.mockResolvedValue(user.id);
      userService.getUserById.mockResolvedValue(user);

      // Создаем диалог
      const createdDialog = await dialogService.getOrCreateDialog(telegramId, character.id);

      // Проверяем, что диалог создан успешно
      expect(createdDialog).toBeDefined();
      expect(createdDialog).not.toBeNull();

      // Получаем диалог по ID
      const retrievedDialog = await dialogService.getDialogById(createdDialog.id);

      // Проверяем результат
      expect(retrievedDialog).toBeDefined();
      expect(retrievedDialog.id).toBe(createdDialog.id);
      expect(retrievedDialog.telegramId).toBe(telegramId);
      expect(retrievedDialog.characterId).toBe(character.id);
    },
  );
});

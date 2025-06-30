import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { DialogService, DialogMessageType } from '../../src/dialog/services/dialog.service';
import { DialogModule } from '../../src/dialog/dialog.module';
import { CacheModule } from '../../src/cache/cache.module';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { MessageQueueModule } from '../../src/message-queue/message-queue.module';
import { ValidationModule } from '../../src/validation/validation.module';
import { v4 as uuidv4 } from 'uuid';
import { TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

describe('DialogService Integration Tests', () => {
  let testingModule: TestingModule;
  let dialogService: DialogService;
  let fixtureManager: FixtureManager;

  beforeEach(async () => {
    const moduleBuilder = TestModuleBuilder.create()
      .withDatabase(false) // Используем моки вместо реальной БД
      .withImports([DialogModule, CacheModule, MessageQueueModule, ValidationModule])
      .withMockTypeOrm()
      .withRequiredMocks();

    testingModule = await moduleBuilder.compile();
    dialogService = testingModule.get<DialogService>(DialogService);

    // Создаем FixtureManager с mock DataSource
    const mockDataSource = testingModule.get<DataSource>(DataSource);
    fixtureManager = new FixtureManager(mockDataSource);
  });

  afterEach(async () => {
    if (testingModule) {
      await testingModule.close();
    }
  });

  it('должен быть определен', () => {
    expect(dialogService).toBeDefined();
  });

  it('должен создавать диалог через FixtureManager', async () => {
    // Очищаем базу данных перед тестом
    await fixtureManager.cleanDatabase();

    // Создаем тестового пользователя и персонажа
    const user = await fixtureManager.createUser();
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();

    const character = await fixtureManager.createCharacter({ user });
    expect(character).toBeDefined();
    expect(character.id).toBeDefined();

    // Используем UUID формат для telegramId в тестах
    const telegramId = uuidv4();

    // Создаем диалог через FixtureManager
    const dialog = await fixtureManager.createDialog({
      telegramId,
      characterId: character.id,
      userId: user.id,
      character,
      isActive: true,
      lastInteractionDate: new Date(),
    });

    // Проверяем результат
    expect(dialog).toBeDefined();
    expect(dialog.id).toBeDefined();
    expect(dialog.telegramId).toBe(telegramId);
    expect(dialog.characterId).toBe(character.id);
    expect(dialog.userId).toBe(user.id);
    expect(dialog.isActive).toBe(true);

    // Проверяем, что диалог сохранен в базе данных
    const savedDialog = await dialogService.getDialogById(dialog.id);
    expect(savedDialog).toBeDefined();
    expect(savedDialog.id).toBe(dialog.id);
    expect(savedDialog.telegramId).toBe(telegramId);
  });

  it('должен находить активный диалог по участникам', async () => {
    // Очищаем базу данных перед тестом
    await fixtureManager.cleanDatabase();

    // Создаем тестового пользователя и персонажа
    const user = await fixtureManager.createUser();
    const character = await fixtureManager.createCharacter({ user });

    // Используем UUID формат для telegramId в тестах
    const telegramId = uuidv4();

    // Создаем диалог через FixtureManager
    const createdDialog = await fixtureManager.createDialog({
      telegramId,
      characterId: character.id,
      userId: user.id,
      character,
      isActive: true,
      lastInteractionDate: new Date(),
    });

    // Проверяем, что диалог создан успешно
    expect(createdDialog).toBeDefined();
    expect(createdDialog.id).toBeDefined();

    // Находим диалог по участникам
    const foundDialog = await dialogService.findActiveDialogByParticipants(
      character.id,
      telegramId,
    );

    // Проверяем результат
    expect(foundDialog).toBeDefined();
    expect(foundDialog.id).toBe(createdDialog.id);
    expect(foundDialog.telegramId).toBe(telegramId);
    expect(foundDialog.characterId).toBe(character.id);
  });

  it('должен сохранять сообщения пользователя и персонажа', async () => {
    // Очищаем базу данных перед тестом
    await fixtureManager.cleanDatabase();

    // Создаем тестового пользователя, персонажа и диалог
    const user = await fixtureManager.createUser();
    const character = await fixtureManager.createCharacter({ user });
    const telegramId = uuidv4();

    const dialog = await fixtureManager.createDialog({
      telegramId,
      characterId: character.id,
      userId: user.id,
      character,
      isActive: true,
      lastInteractionDate: new Date(),
    });

    // Сохраняем сообщение пользователя
    const userMessage = await dialogService.createMessage({
      dialogId: dialog.id,
      content: 'Привет! Как дела?',
      type: DialogMessageType.USER,
    });

    expect(userMessage).toBeDefined();
    expect(userMessage.content).toBe('Привет! Как дела?');
    expect(userMessage.dialogId).toBe(dialog.id);

    // Сохраняем сообщение персонажа
    const characterMessage = await dialogService.saveCharacterMessageDirect(
      dialog.id,
      'Привет! Отлично, спасибо!',
    );

    expect(characterMessage).toBeDefined();
    expect(characterMessage.content).toBe('Привет! Отлично, спасибо!');
    expect(characterMessage.dialogId).toBe(dialog.id);

    // Проверяем, что сообщения сохранены
    const messages = await dialogService.getDialogMessages(dialog.id, 1, 10);
    expect(messages).toBeDefined();
    expect(Array.isArray(messages)).toBe(true);
    const messageArray = messages as any[];
    expect(messageArray.length).toBe(2);
  });

  it('должен получать историю диалога', async () => {
    // Очищаем базу данных перед тестом
    await fixtureManager.cleanDatabase();

    // Создаем тестового пользователя, персонажа и диалог
    const user = await fixtureManager.createUser();
    const character = await fixtureManager.createCharacter({ user });
    const telegramId = uuidv4();

    const dialog = await fixtureManager.createDialog({
      telegramId,
      characterId: character.id,
      userId: user.id,
      character,
      isActive: true,
      lastInteractionDate: new Date(),
    });

    // Добавляем несколько сообщений
    await dialogService.createMessage({
      dialogId: dialog.id,
      content: 'Первое сообщение',
      type: DialogMessageType.USER,
    });

    await dialogService.saveCharacterMessageDirect(dialog.id, 'Ответ персонажа');

    await dialogService.createMessage({
      dialogId: dialog.id,
      content: 'Второе сообщение',
      type: DialogMessageType.USER,
    });

    // Получаем историю диалога через getDialogHistory
    const history = await dialogService.getDialogHistory(telegramId, character.id, 10);

    expect(history).toBeDefined();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(3);
    expect(history.every(msg => msg.dialogId === dialog.id)).toBe(true);
  });

  it('должен получать диалог по ID', async () => {
    // Очищаем базу данных перед тестом
    await fixtureManager.cleanDatabase();

    // Создаем тестового пользователя, персонажа и диалог
    const user = await fixtureManager.createUser();
    const character = await fixtureManager.createCharacter({ user });
    const telegramId = uuidv4();

    const dialog = await fixtureManager.createDialog({
      telegramId,
      characterId: character.id,
      userId: user.id,
      character,
      isActive: true,
      lastInteractionDate: new Date(),
    });

    // Получаем диалог по ID
    const foundDialog = await dialogService.getDialogById(dialog.id);

    expect(foundDialog).toBeDefined();
    expect(foundDialog.id).toBe(dialog.id);
    expect(foundDialog.telegramId).toBe(telegramId);
    expect(foundDialog.characterId).toBe(character.id);
    expect(foundDialog.userId).toBe(user.id);
    expect(foundDialog.isActive).toBe(true);
  });
});

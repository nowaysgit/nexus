import { createTestSuite } from '../../lib/tester';
import { TestingModule } from '@nestjs/testing';
import { TestModuleBuilder, createTest, TestConfigType } from '../../lib/tester';
import { TestConfigurations } from '../../lib/tester/test-configurations';
import { DataSource } from 'typeorm';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';

import { CharacterService } from '../../src/character/services/character.service';
import { MessageProcessingCoordinator } from '../../src/character/services/message-processing-coordinator.service';
import { CharacterResponseService } from '../../src/character/services/character-response.service';
import { DialogService, DialogMessageType } from '../../src/dialog/services/dialog.service';
import { UserService } from '../../src/user/services/user.service';
import { LLMService } from '../../src/llm/services/llm.service';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { CharacterModule } from '../../src/character/character.module';
import { UserModule } from '../../src/user/user.module';
import { DialogModule } from '../../src/dialog/dialog.module';
import { LLMModule } from '../../src/llm/llm.module';
import { CacheModule } from '../../src/cache/cache.module';
import { LoggingModule } from '../../src/logging/logging.module';
import { MessageQueueModule } from '../../src/message-queue/message-queue.module';
import { ValidationModule } from '../../src/validation/validation.module';
import { MonitoringModule } from '../../src/monitoring/monitoring.module';
import { PromptTemplateModule } from '../../src/prompt-template/prompt-template.module';
import { v4 as uuidv4 } from 'uuid';
import { Message } from '../../src/dialog/entities/message.entity';

createTestSuite('Character Workflow Integration Tests', () => {
  let moduleRef: TestingModule;
  let fixtureManager: FixtureManager;
  let dataSource: DataSource;

  beforeAll(async () => {
    const rawImports = [
      CharacterModule,
      UserModule,
      DialogModule,
      LLMModule,
      CacheModule,
      LoggingModule,
      MessageQueueModule,
      ValidationModule,
      MonitoringModule,
      PromptTemplateModule,
    ];

    const imports = TestConfigurations.prepareImportsForTesting(rawImports);
    const providers = TestConfigurations.requiredMocksAdder(imports);

    moduleRef = await TestModuleBuilder.create()
      .withImports(imports as any)
      .withProviders(providers as any)
      .withRequiredMocks()
      .compile();

    dataSource = moduleRef.get<DataSource>('DataSource');
    fixtureManager = new FixtureManager(dataSource);
  });

  beforeEach(async () => {
    // Очищаем базу данных перед каждым тестом
    await fixtureManager.cleanDatabase();
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  createTest(
    {
      name: 'полный рабочий процесс взаимодействия персонажа',
      configType: TestConfigType.INTEGRATION,
      requiresDatabase: true,
      timeout: 30000, // Увеличиваем таймаут для интеграционного теста
    },
    async () => {
      const _userService = moduleRef.get<UserService>(UserService);
      const _characterService = moduleRef.get<CharacterService>(CharacterService);
      const dialogService = moduleRef.get<DialogService>(DialogService);
      const messageCoordinator = moduleRef.get<MessageProcessingCoordinator>(
        MessageProcessingCoordinator,
      );
      const responseService = moduleRef.get<CharacterResponseService>(CharacterResponseService);
      const llmService = moduleRef.get<LLMService>(LLMService);

      // Мокаем LLM для генерации ответа
      jest.spyOn(llmService, 'generateText').mockResolvedValue({
        text: 'Привет! Меня зовут Алиса, и я рада с тобой познакомиться. Как дела?',
        requestInfo: {
          requestId: 'test-id',
          fromCache: false,
          executionTime: 100,
          totalTokens: 25,
          model: 'test-model',
        },
      });

      // Шаг 1. Создание пользователя с уникальным telegramId
      const telegramId = uuidv4(); // Используем UUID для гарантии уникальности
      const userData = {
        telegramId,
        username: 'testuser',
        firstName: 'Тест',
        lastName: 'Пользователь',
        email: `test-${telegramId}@example.com`,
      };

      const user = await fixtureManager.createUser(userData);
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.telegramId).toBe(telegramId);

      // Шаг 2. Создание персонажа
      const characterData = {
        name: 'Алиса',
        age: 25,
        archetype: CharacterArchetype.CAREGIVER,
        biography: 'Дружелюбная девушка, которая любит общаться',
        appearance: 'Привлекательная девушка с добрыми глазами',
        user: user,
        personality: {
          traits: ['дружелюбная', 'общительная', 'любознательная'],
          hobbies: ['чтение', 'музыка', 'путешествия'],
          fears: ['одиночество', 'темнота'],
          values: ['дружба', 'честность', 'творчество'],
          musicTaste: ['поп', 'рок'],
          strengths: ['эмпатия', 'коммуникабельность'],
          weaknesses: ['доверчивость'],
        },
        isActive: true,
      };

      const character = await fixtureManager.createCharacter(characterData);
      expect(character).toBeDefined();
      expect(character.id).toBeDefined();

      // Шаг 3. Создание диалога через FixtureManager
      const dialog = await fixtureManager.createDialog({
        telegramId,
        characterId: character.id,
        userId: typeof user.id === 'string' ? parseInt(user.id, 10) : user.id,
        user: user,
        character: character,
        isActive: true,
        lastInteractionDate: new Date(),
      });

      expect(dialog).toBeDefined();
      expect(dialog.id).toBeDefined();
      expect(dialog.telegramId).toBe(telegramId);
      expect(dialog.characterId).toBe(character.id);

      // Проверяем, что диалог создан и может быть найден
      const foundDialog = await dialogService.findActiveDialogByParticipants(
        character.id,
        telegramId,
      );
      expect(foundDialog).toBeDefined();
      expect(foundDialog.id).toBe(dialog.id);

      // Шаг 4. Обработка входящего сообщения пользователя
      const userMessage = 'Привет! Как тебя зовут?';

      const analysisResult = await messageCoordinator.processUserMessage(
        character,
        user.id,
        userMessage,
        [],
      );
      expect(analysisResult).toBeDefined();

      // Шаг 5. Генерация ответа персонажа
      const response = await responseService.generateResponse(character, userMessage, [], {
        primary: 'neutral',
        secondary: 'calm',
        intensity: 50,
        description: 'Спокойное нейтральное состояние',
      });
      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThan(0);

      // Шаг 6. Сохранение сообщений в диалог
      // Сначала сохраняем сообщение пользователя
      const userMessageEntity = await dialogService.createMessage({
        dialogId: dialog.id,
        content: userMessage,
        type: DialogMessageType.USER,
      });

      expect(userMessageEntity).toBeDefined();
      expect(userMessageEntity.id).toBeDefined();
      expect(userMessageEntity.content).toBe(userMessage);
      expect(userMessageEntity.isFromUser).toBe(true);

      // Затем сохраняем ответ персонажа
      const characterMessageEntity = await dialogService.saveCharacterMessageDirect(
        dialog.id,
        response,
      );

      expect(characterMessageEntity).toBeDefined();
      expect(characterMessageEntity.id).toBeDefined();
      expect(characterMessageEntity.content).toBe(response);
      expect(characterMessageEntity.isFromUser).toBe(false);

      // Шаг 7. Проверка сохранённых сообщений
      const messagesResult = await dialogService.getDialogMessages(dialog.id, 1, 100);
      expect(messagesResult).toBeDefined();

      // Проверяем, что сообщения сохранены и могут быть получены
      const messages = Array.isArray(messagesResult) ? messagesResult : messagesResult.messages;

      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBe(2);

      // Проверяем содержимое сообщений
      const messageContents = messages.map((m: Message) => m.content);
      expect(messageContents).toContain(userMessage);
      expect(messageContents).toContain(response);

      // Проверяем, что сообщения также можно получить через getDialogHistory
      const historyMessages = await dialogService.getDialogHistory(telegramId, character.id);
      expect(historyMessages).toBeDefined();
      expect(Array.isArray(historyMessages)).toBe(true);
      expect(historyMessages.length).toBe(2);
    },
  );
});

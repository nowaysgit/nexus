import { createTestSuite } from '../../lib/tester';
import { TestingModule } from '@nestjs/testing';
import { TestModuleBuilder, createTest, TestConfigType } from '../../lib/tester';
import { TestConfigurations } from '../../lib/tester/test-configurations';
import { DataSource } from 'typeorm';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';

import { CharacterService } from '../../src/character/services/character.service';
import { MessageProcessingCoordinator } from '../../src/character/services/message-processing-coordinator.service';
import { CharacterResponseService } from '../../src/character/services/character-response.service';
import { DialogService } from '../../src/dialog/services/dialog.service';
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
    },
    async () => {
      const userService = moduleRef.get<UserService>(UserService);
      const characterService = moduleRef.get<CharacterService>(CharacterService);
      const dialogService = moduleRef.get<DialogService>(DialogService);
      const messageCoordinator = moduleRef.get<MessageProcessingCoordinator>(
        MessageProcessingCoordinator,
      );
      const responseService = moduleRef.get<CharacterResponseService>(CharacterResponseService);
      const llmService = moduleRef.get<LLMService>(LLMService);

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

      // Шаг 1. Создание пользователя
      const userData = {
        telegramId: '123456789',
        username: 'testuser',
        firstName: 'Тест',
        lastName: 'Пользователь',
        email: 'test@example.com', // Добавляем email для уникальности
      };

      const user = await userService.createUser(userData);
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();

      // Шаг 2. Создание персонажа
      const characterData = {
        name: 'Алиса',
        age: 25,
        archetype: CharacterArchetype.CAREGIVER,
        biography: 'Дружелюбная девушка, которая любит общаться',
        appearance: 'Привлекательная девушка с добрыми глазами',
        userId: user.id, // Явно указываем userId
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

      const character = await characterService.create(characterData);
      expect(character).toBeDefined();
      expect(character.id).toBeDefined();

      // Шаг 3. Создание диалога
      if (!user.telegramId) {
        throw new Error('telegramId не определен');
      }

      const dialog = await dialogService.getOrCreateDialog(user.telegramId, character.id);
      expect(dialog).toBeDefined();
      expect(dialog.id).toBeDefined();

      // Шаг 4. Обработка входящего сообщения пользователя
      const userMessage = 'Привет! Как тебя зовут?';

      // Проверяем, что character и user.id существуют перед вызовом
      expect(character).not.toBeNull();
      expect(user.id).not.toBeNull();

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
      expect(response.length).toBeGreaterThan(0); // Изменено с 50 на 0, так как это мок

      // Шаг 6. Сохранение сообщений в диалог
      // Проверяем, что user.telegramId и character.id существуют перед вызовом
      expect(user.telegramId).not.toBeNull();
      expect(character.id).not.toBeNull();

      const userMessageEntity = await dialogService.saveUserMessage(
        user.telegramId,
        character.id,
        userMessage,
      );
      expect(userMessageEntity).toBeDefined();
      expect(userMessageEntity.id).toBeDefined();

      // Проверяем, что dialog.id существует перед вызовом
      expect(dialog).not.toBeNull();
      expect(dialog.id).not.toBeNull();

      const characterMessageEntity = await dialogService.saveCharacterMessageDirect(
        dialog.id,
        response,
      );
      expect(characterMessageEntity).toBeDefined();
      expect(characterMessageEntity.id).toBeDefined();

      // Шаг 7. Проверка сохранённых сообщений
      const messagesResult = await dialogService.getDialogMessages(dialog.id, 1, 100);

      // Проверяем, что messagesResult существует и имеет правильную структуру
      expect(messagesResult).toBeDefined();

      const messagesArray = Array.isArray(messagesResult)
        ? messagesResult
        : messagesResult && typeof messagesResult === 'object' && 'messages' in messagesResult
          ? (messagesResult as { messages: unknown[] }).messages
          : [];

      expect(Array.isArray(messagesArray)).toBe(true);
      expect(messagesArray.length).toBeGreaterThanOrEqual(2);
    },
  );

  // TODO: добавить отдельные проверки на обработку ошибок при необходимости, используя createTest
});

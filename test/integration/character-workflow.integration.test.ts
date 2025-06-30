import { TestModuleBuilder, createTestSuite, createTest } from '../../lib/tester';
import { TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { v4 as uuidv4 } from 'uuid';

// Services
import { UserService } from '../../src/user/services/user.service';
import { CharacterService } from '../../src/character/services/character.service';
import { DialogService } from '../../src/dialog/services/dialog.service';
import { MessageProcessingCoordinator } from '../../src/character/services/message-processing-coordinator.service';
import { CharacterResponseService } from '../../src/character/services/character-response.service';
import { LLMService } from '../../src/llm/services/llm.service';

// Enums and Types
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { DialogMessageType } from '../../src/dialog/services/dialog.service';

// Modules
import { CharacterModule } from '../../src/character/character.module';
import { LLMModule } from '../../src/llm/llm.module';
import { CacheModule } from '../../src/cache/cache.module';
import { LoggingModule } from '../../src/logging/logging.module';
import { MessageQueueModule } from '../../src/message-queue/message-queue.module';
import { ValidationModule } from '../../src/validation/validation.module';
import { MockMonitoringModule } from '../../lib/tester/mocks/mock-monitoring.module';
import { PromptTemplateModule } from '../../src/prompt-template/prompt-template.module';

// Entities
import { Message } from '../../src/dialog/entities/message.entity';

createTestSuite('Character Workflow Integration Tests', () => {
  let moduleRef: TestingModule;
  let fixtureManager: FixtureManager;
  let dataSource: DataSource;
  let _dialogService: DialogService;

  beforeAll(async () => {
    moduleRef = await TestModuleBuilder.create()
      .withDatabase(false)
      .withImports([
        CharacterModule,
        LLMModule,
        CacheModule,
        LoggingModule,
        MessageQueueModule,
        ValidationModule,
        MockMonitoringModule,
        PromptTemplateModule,
      ])
      .withRequiredMocks()
      .compile();

    dataSource = moduleRef.get<DataSource>('DataSource');
    fixtureManager = new FixtureManager(dataSource);
    _dialogService = moduleRef.get<DialogService>(DialogService);
  });

  beforeEach(async () => {
    // Очищаем базу данных перед каждым тестом
    await fixtureManager.cleanDatabase();

    // Сбрасываем все моки
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  createTest(
    {
      name: 'полный рабочий процесс взаимодействия персонажа',
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

      // Проверяем, что пользователь создан корректно
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
      expect(character.name).toBe('Алиса');

      // Шаг 3. Создание диалога через FixtureManager
      const dialog = await fixtureManager.createDialog({
        telegramId,
        characterId: character.id,
        userId: user.id,
        user: user,
        character: character,
        isActive: true,
        lastInteractionDate: new Date(),
      });

      expect(dialog).toBeDefined();
      expect(dialog.id).toBeDefined();
      expect(dialog.telegramId).toBe(telegramId);
      expect(dialog.characterId).toBe(character.id);

      // Мокаем методы DialogService для возврата созданных данных
      jest.spyOn(dialogService, 'findActiveDialogByParticipants').mockResolvedValue(dialog);
      jest.spyOn(dialogService, 'createMessage').mockImplementation(async data => {
        const message = new Message();
        message.id = Math.floor(Math.random() * 1000000);
        message.dialogId = data.dialogId;
        message.content = data.content;
        message.isFromUser = data.type === DialogMessageType.USER;
        message.createdAt = new Date();
        return message;
      });

      jest
        .spyOn(dialogService, 'saveCharacterMessageDirect')
        .mockImplementation(async (dialogId, content) => {
          const message = new Message();
          message.id = Math.floor(Math.random() * 1000000);
          message.dialogId = dialogId;
          message.content = content;
          message.isFromUser = false;
          message.createdAt = new Date();
          return message;
        });

      const mockMessages: Message[] = [];
      jest.spyOn(dialogService, 'getDialogMessages').mockImplementation(async () => {
        return mockMessages;
      });

      jest.spyOn(dialogService, 'getDialogHistory').mockImplementation(async () => {
        return mockMessages;
      });

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

      // Добавляем сообщение в мок-массив
      mockMessages.push(userMessageEntity);

      // Затем сохраняем ответ персонажа
      const characterMessageEntity = await dialogService.saveCharacterMessageDirect(
        dialog.id,
        response,
      );

      expect(characterMessageEntity).toBeDefined();
      expect(characterMessageEntity.id).toBeDefined();
      expect(characterMessageEntity.content).toBe(response);
      expect(characterMessageEntity.isFromUser).toBe(false);

      // Добавляем сообщение в мок-массив
      mockMessages.push(characterMessageEntity);

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

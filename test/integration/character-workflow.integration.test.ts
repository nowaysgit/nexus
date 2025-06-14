import { createTestSuite, createTestDataSource } from '../../lib/tester';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

import { FixtureManager } from '../../lib/tester/fixtures';
import { CharacterService } from '../../src/character/services/character.service';
import { MessageProcessingCoordinator } from '../../src/character/services/message-processing-coordinator.service';
import { CharacterResponseService } from '../../src/character/services/character-response.service';
import { DialogService } from '../../src/dialog/services/dialog.service';
import { UserService } from '../../src/user/services/user.service';
import { LLMService } from '../../src/llm/services/llm.service';
import { CacheService } from '../../src/cache/cache.service';
import { Character } from '../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { User } from '../../src/user/entities/user.entity';
import { Dialog } from '../../src/dialog/entities/dialog.entity';
import { Repository } from 'typeorm';
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
import { Message } from '../../src/dialog/entities/message.entity';

createTestSuite('Character Workflow Integration Tests', () => {
  let fixtureManager: FixtureManager;

  beforeEach(async () => {
    const dataSource = await createTestDataSource();
    fixtureManager = new FixtureManager(dataSource);
    await fixtureManager.cleanDatabase();
  });

  it('should handle complete character interaction workflow', async () => {
    // Создаем тестовый модуль
    const moduleRef = await Test.createTestingModule({
      imports: [
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
      ],
      providers: [
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
          },
        },
      ],
    }).compile();

    // Получаем сервисы и репозитории

    // Получаем сервисы
    const characterService = moduleRef.get(CharacterService);
    const userService = moduleRef.get(UserService);
    const dialogService = moduleRef.get(DialogService);
    const messageCoordinator = moduleRef.get(MessageProcessingCoordinator);
    const responseService = moduleRef.get(CharacterResponseService);
    const llmService = moduleRef.get(LLMService);
    const cacheService = moduleRef.get(CacheService);

    // Получаем репозитории
    const userRepository = moduleRef.get(getRepositoryToken(User));
    const characterRepository = moduleRef.get(getRepositoryToken(Character));
    const dialogRepository = moduleRef.get(getRepositoryToken(Dialog));

    // Мокаем LLM сервис
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
    // 1. Создаем пользователя
    const userData = {
      telegramId: '123456789',
      username: 'testuser',
      firstName: 'Тест',
      lastName: 'Пользователь',
    };

    const user = await userService.createUser(userData);
    expect(user).toBeDefined();
    expect(user.telegramId).toBe(userData.telegramId);

    // Проверяем, что пользователь сохранен в БД
    const savedUser = await userRepository.findOne({ where: { id: user.id } });
    expect(savedUser).toBeDefined();
    expect(savedUser.telegramId).toBe(userData.telegramId);

    // 2. Создаем персонажа
    const characterData = {
      name: 'Алиса',
      age: 25,
      archetype: CharacterArchetype.CAREGIVER,
      biography: 'Дружелюбная девушка, которая любит общаться',
      appearance: 'Привлекательная девушка с добрыми глазами',
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
    expect(character.name).toBe(characterData.name);

    // Проверяем, что персонаж сохранен в БД
    const savedCharacter = await characterRepository.findOne({
      where: { id: character.id },
      relations: ['personality'],
    });
    expect(savedCharacter).toBeDefined();
    expect(savedCharacter.name).toBe(characterData.name);

    // 3. Создаем диалог между пользователем и персонажем
    const dialog = await dialogService.getOrCreateDialog(user.telegramId, character.id);
    expect(dialog).toBeDefined();
    expect(dialog.telegramId).toBe(user.telegramId);
    expect(dialog.characterId).toBe(character.id);

    // Проверяем, что диалог сохранен в БД
    const savedDialog = await dialogRepository.findOne({ where: { id: dialog.id } });
    expect(savedDialog).toBeDefined();

    // 4. Обрабатываем входящее сообщение пользователя
    const userMessage = 'Привет! Как тебя зовут?';

    // Координатор обрабатывает сообщение
    const analysisResult = await messageCoordinator.processUserMessage(
      character,
      parseInt(user.id),
      userMessage,
      [], // Пустой массив recentMessages вместо dialog.id
    );

    expect(analysisResult).toBeDefined();

    // 5. Генерируем ответ персонажа
    const response = await responseService.generateResponse(character, userMessage, [], {
      primary: 'neutral',
      secondary: 'calm',
      intensity: 50,
      description: 'Спокойное нейтральное состояние',
    });

    expect(response).toBeDefined();
    expect(response).toContain('Алиса');
    expect(response.length).toBeGreaterThan(50); // Детальный ответ

    // 6. Сохраняем сообщения в диалог
    const userMessageEntity = await dialogService.saveUserMessage(
      user.telegramId,
      character.id,
      userMessage,
    );
    expect(userMessageEntity).toBeDefined();

    const characterMessageEntity = await dialogService.saveCharacterMessageDirect(
      dialog.id,
      response,
    );
    expect(characterMessageEntity).toBeDefined();

    // 7. Проверяем, что сообщения сохранены
    const messagesResult = await dialogService.getDialogMessages(dialog.id, 1, 100);

    // Проверяем, что в тестовом окружении возвращается массив сообщений
    expect(messagesResult).toBeDefined();
    expect(Array.isArray(messagesResult)).toBe(true);

    // Приводим к массиву сообщений, т.к. в тестовом окружении это массив
    const messages = messagesResult as Message[];
    expect(messages.length).toBeGreaterThanOrEqual(2);

    const userMsg = messages.find(msg => msg.content === userMessage);
    const charMsg = messages.find(msg => msg.content === response);
    expect(userMsg).toBeDefined();
    expect(charMsg).toBeDefined();

    // 8. Проверяем кеширование (если используется)
    const cacheKey = `dialog:${user.telegramId}:${character.id}`;
    const cachedData = await cacheService.get(cacheKey);
    // Кеш может содержать диалог

    // 9. Получаем историю диалога
    const history = await dialogService.getDialogHistory(user.telegramId, character.id, 10); // TODO: Проверить правильный тип аргумента для limit или categories
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle error scenarios gracefully', async () => {
    // Создаем тестовый модуль
    const moduleRef = await Test.createTestingModule({
      imports: [
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
      ],
      providers: [],
    }).compile();

    // Получаем сервисы и репозитории

    const characterService = moduleRef.get(CharacterService);

    const userService = moduleRef.get(UserService);
    const dialogService = moduleRef.get(DialogService);
    const llmService = moduleRef.get(LLMService);

    // Мокаем ошибку LLM сервиса
    jest.spyOn(llmService, 'generateText').mockRejectedValue(new Error('LLM service unavailable'));

    // Создаем пользователя и персонажа
    const user = await userService.createUser({
      telegramId: '987654321',
      username: 'erroruser',
      firstName: 'Error',
      lastName: 'User',
    });
    const character = await characterService.create({
      name: 'Тестовый персонаж',
      fullName: 'Тестовый Персонаж Полное Имя',
      age: 25,
      biography: 'Биография тестового персонажа',
      appearance: 'Внешний вид тестового персонажа',
      personality: {
        traits: ['дружелюбный', 'умный'],
        values: ['честность', 'доброта'],
        hobbies: ['чтение', 'музыка'],
        fears: ['высота', 'темнота'],
        strengths: ['коммуникабельность', 'аналитическое мышление'],
        weaknesses: ['нетерпеливость', 'упрямство'],
      },
      archetype: CharacterArchetype.CAREGIVER,
      isActive: true,
    });
    // Пытаемся создать диалог с несуществующим персонажем
    await expect(dialogService.getOrCreateDialog(user.telegramId, 99999)).rejects.toThrow();
  });
});

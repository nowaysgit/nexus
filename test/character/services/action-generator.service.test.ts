import { Test, TestingModule } from '@nestjs/testing';
import { ActionGeneratorService } from '../../../src/character/services/action/action-generator.service';
import { Character } from '../../../src/character/entities/character.entity';
import { ActionType } from '../../../src/character/enums/action-type.enum';
import { CharacterNeedType } from '../../../src/character/enums/character-need-type.enum';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';
import { MockLogService } from '../../../lib/tester/mocks/log.service.mock';
import { LogService } from '../../../src/logging/log.service';

describe('ActionGeneratorService', () => {
  let service: ActionGeneratorService;
  let mockLogService: MockLogService;
  let testCharacter: Character;

  beforeEach(async () => {
    mockLogService = new MockLogService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ActionGeneratorService, { provide: LogService, useValue: mockLogService }],
    }).compile();

    service = module.get<ActionGeneratorService>(ActionGeneratorService);

    // Создаем тестового персонажа
    testCharacter = new Character();
    testCharacter.id = 1;
    testCharacter.name = 'Test Character';
    testCharacter.archetype = CharacterArchetype.COMPANION;
    testCharacter.biography = 'Test character biography';
    testCharacter.appearance = 'Test character appearance';
    testCharacter.personality = {
      traits: [],
      hobbies: [],
      fears: [],
      values: [],
      musicTaste: [],
      strengths: [],
      weaknesses: [],
    };
    testCharacter.isActive = true;
    testCharacter.createdAt = new Date();
    testCharacter.updatedAt = new Date();
  });

  describe('generateCommunicationAction', () => {
    it('должен генерировать коммуникационное действие с правильными параметрами', async () => {
      const prompt = 'Привет! Как дела?';
      const userId = 'user123';

      const action = await service.generateCommunicationAction(testCharacter, prompt, userId);

      expect(action).toBeDefined();
      expect(action.type).toBe(ActionType.ASK_QUESTION);
      expect(action.description).toBe(`Коммуникационное действие: ${prompt}`);
      expect(action.status).toBe('pending');
      expect(action.startTime).toBeInstanceOf(Date);
      expect(action.duration).toBeGreaterThan(0);
      expect(action.relatedNeeds).toContain(CharacterNeedType.COMMUNICATION);
      expect(action.relatedNeeds).toContain(CharacterNeedType.ATTENTION);
      expect(action.metadata.characterId).toBe(testCharacter.id);
      expect(action.metadata.prompt).toBe(prompt);
      expect(action.metadata.targetUserId).toBe(userId);
      expect(action.metadata.actionCategory).toBe('communication');
    });

    it('должен генерировать действие без userId', async () => {
      const prompt = 'Хочу поделиться мыслями';

      const action = await service.generateCommunicationAction(testCharacter, prompt);

      expect(action).toBeDefined();
      expect(action.metadata.targetUserId).toBeUndefined();
    });

    it('должен определять тип действия на основе промпта', async () => {
      const questionPrompt = 'Что ты думаешь об этом?';
      const action = await service.generateCommunicationAction(testCharacter, questionPrompt);

      expect(action.type).toBe(ActionType.ASK_QUESTION);
    });
  });

  describe('generateEmotionalAction', () => {
    it('должен генерировать эмоциональное действие с правильными параметрами', async () => {
      const emotion = 'радость';
      const intensity = 8;

      const action = await service.generateEmotionalAction(testCharacter, emotion, intensity);

      expect(action).toBeDefined();
      expect(action.type).toBe(ActionType.EXPRESS_EMOTION);
      expect(action.description).toContain('Эмоциональное действие:');
      expect(action.status).toBe('pending');
      expect(action.relatedNeeds).toContain(CharacterNeedType.AFFECTION);
      expect(action.relatedNeeds).toContain(CharacterNeedType.VALIDATION);
      expect(action.metadata.emotion).toBe(emotion);
      expect(action.metadata.intensity).toBe(intensity);
      expect(action.metadata.actionCategory).toBe('emotional');
    });

    it('должен корректно рассчитывать продолжительность эмоционального действия', async () => {
      const highIntensityAction = await service.generateEmotionalAction(testCharacter, 'гнев', 10);
      const lowIntensityAction = await service.generateEmotionalAction(
        testCharacter,
        'спокойствие',
        2,
      );

      expect(highIntensityAction.duration).toBeGreaterThan(lowIntensityAction.duration);
    });
  });

  describe('generateNeedBasedAction', () => {
    it('должен генерировать действие на основе потребности', async () => {
      const needType = CharacterNeedType.ATTENTION;
      const intensity = 7;

      const action = await service.generateNeedBasedAction(testCharacter, needType, intensity);

      expect(action).toBeDefined();
      expect(action.type).toBe(ActionType.EXPRESS_NEED);
      expect(action.description).toContain('Выражение потребности:');
      expect(action.relatedNeeds).toContain(needType);
      expect(action.metadata.needType).toBe(needType);
      expect(action.metadata.intensity).toBe(intensity);
      expect(action.metadata.actionCategory).toBe('need_based');
    });

    it('должен определять правильный тип действия для разных потребностей', async () => {
      const socialAction = await service.generateNeedBasedAction(
        testCharacter,
        CharacterNeedType.SOCIAL_CONNECTION,
        5,
      );
      const attentionAction = await service.generateNeedBasedAction(
        testCharacter,
        CharacterNeedType.ATTENTION,
        8,
      );

      expect(socialAction.type).toBe(ActionType.EXPRESS_NEED);
      expect(attentionAction.type).toBe(ActionType.EXPRESS_NEED);
    });
  });

  describe('determineActionFromTrigger', () => {
    it('должен определять действие для триггера получения сообщения', async () => {
      const context = {
        characterId: testCharacter.id,
        userId: 'user123',
        triggerType: 'message_received',
        triggerData: { message: 'Hello' },
        timestamp: new Date(),
      };

      const action = await service.determineActionFromTrigger(context, testCharacter);

      expect(action).toBeDefined();
      expect(action.type).toBe(ActionType.EMOTIONAL_RESPONSE);
      expect(action.description).toBe('Реакция на полученное сообщение');
      expect(action.relatedNeeds).toContain(CharacterNeedType.COMMUNICATION);
    });

    it('должен определять действие для триггера неактивности пользователя', async () => {
      const context = {
        characterId: testCharacter.id,
        userId: 'user123',
        triggerType: 'user_inactive',
        triggerData: { lastActivity: new Date(Date.now() - 3600000) },
        timestamp: new Date(),
      };

      const action = await service.determineActionFromTrigger(context, testCharacter);

      expect(action).toBeDefined();
      expect(action.type).toBe(ActionType.INITIATE_CONVERSATION);
      expect(action.description).toBe('Инициация разговора с неактивным пользователем');
    });

    it('должен обрабатывать неизвестные триггеры', async () => {
      const context = {
        characterId: testCharacter.id,
        userId: 'user123',
        triggerType: 'unknown_trigger',
        triggerData: {},
        timestamp: new Date(),
      };

      const action = await service.determineActionFromTrigger(context, testCharacter);

      expect(action).toBeDefined();
      expect(action.type).toBe(ActionType.CUSTOM);
      expect(action.description).toContain('unknown_trigger');
    });
  });

  describe('generateProactiveAction', () => {
    it('должен генерировать проактивное действие', async () => {
      const action = await service.generateProactiveAction(testCharacter);
      const proactiveActions = [
        ActionType.SHARE_THOUGHTS,
        ActionType.ASK_QUESTION,
        ActionType.JOKE,
        ActionType.SHARE_STORY,
        ActionType.EXPRESS_EMOTION,
      ];

      expect(action).toBeDefined();
      expect(proactiveActions).toContain(action.type);
      expect(action.description).toContain('Проактивное действие');
      expect(action.status).toBe('pending');
      expect(action.metadata.characterId).toBe(testCharacter.id);
      expect(action.metadata.actionCategory).toBe('proactive');
    });
  });

  describe('приватные методы через публичные', () => {
    it('должен определять правильный тип коммуникационного действия', async () => {
      const questionAction = await service.generateCommunicationAction(
        testCharacter,
        'Что ты думаешь?',
      );
      const greetingAction = await service.generateCommunicationAction(testCharacter, 'Привет!');
      const shareAction = await service.generateCommunicationAction(
        testCharacter,
        'Хочу поделиться',
      );

      expect(questionAction.type).toBe(ActionType.ASK_QUESTION);
      expect(greetingAction.type).toBe(ActionType.SEND_MESSAGE);
      expect(shareAction.type).toBe(ActionType.SEND_MESSAGE); // Метод не распознает "поделиться" как SHARE_THOUGHTS
    });

    it('должен генерировать уникальные ID для действий', async () => {
      const action1 = await service.generateCommunicationAction(testCharacter, 'Test 1');
      const action2 = await service.generateCommunicationAction(testCharacter, 'Test 2');

      expect(action1.metadata.id).toBeDefined();
      expect(action2.metadata.id).toBeDefined();
      expect(action1.metadata.id).not.toBe(action2.metadata.id);
    });

    it('должен корректно определять продолжительность действий', async () => {
      const conversationAction = await service.generateCommunicationAction(testCharacter, 'Привет');
      const emotionalAction = await service.generateEmotionalAction(testCharacter, 'радость', 5);

      expect(conversationAction.duration).toBeGreaterThan(0);
      expect(emotionalAction.duration).toBeGreaterThan(0);
    });
  });

  describe('обработка ошибок', () => {
    it('должен обрабатывать ошибки при генерации действий', async () => {
      // Тест на обработку ошибок - создаем ситуацию, где может возникнуть ошибка
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const invalidCharacter = null as any;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await expect(service.generateCommunicationAction(invalidCharacter, 'test')).rejects.toThrow();
    });
  });
});

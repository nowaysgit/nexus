import { createTestSuite, createTest } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { DataSource } from 'typeorm';
import {
  ContextCompressionService,
  DataImportanceLevel,
  CompressionType,
} from '../../src/character/services/analysis/context-compression.service';
import { LogService } from '../../src/logging/log.service';
import { MockLogService } from '../../lib/tester/mocks';
import { LLMService } from '../../src/llm/services/llm.service';
import { DialogService } from '../../src/dialog/services/dialog.service';
import { PromptTemplateService } from '../../src/prompt-template/prompt-template.service';
import { Message } from '../../src/dialog/entities/message.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Character } from '../../src/character/entities/character.entity';

const testProviders = [
  ContextCompressionService,
  {
    provide: LLMService,
    useValue: {
      generateText: jest.fn().mockResolvedValue({
        text: 'significant',
        usage: { totalTokens: 10 },
      }),
      generateResponse: jest.fn().mockResolvedValue({
        text: 'Тестовый ответ',
        usage: { totalTokens: 50 },
      }),
    },
  },
  {
    provide: DialogService,
    useValue: {
      getDialogHistory: jest.fn().mockResolvedValue([]),
      createDialog: jest.fn().mockResolvedValue({ id: 1 }),
      getDialogMessages: jest.fn().mockResolvedValue({ messages: [], total: 0 }),
      findActiveDialogByParticipants: jest.fn().mockResolvedValue(null),
    },
  },
  {
    provide: PromptTemplateService,
    useValue: {
      createPrompt: jest
        .fn()
        .mockReturnValue('Проанализируй важность следующего текста: {content}'),
      getTemplate: jest.fn().mockReturnValue('Шаблон промпта'),
      updateTemplate: jest.fn(),
    },
  },
  {
    provide: LogService,
    useValue: new MockLogService(),
  },
];

createTestSuite('ContextCompressionService Tests', () => {
  let moduleRef: import('@nestjs/testing').TestingModule | null = null;
  let dataSource: DataSource;
  let fixtureManager: FixtureManager;
  let contextCompressionService: ContextCompressionService;

  beforeEach(async () => {
    moduleRef = await TestModuleBuilder.create()
      .withImports([TypeOrmModule.forFeature([Message, Character])])
      .withProviders(testProviders)
      .withRequiredMocks()
      .compile();

    dataSource = moduleRef.get<DataSource>(DataSource);
    fixtureManager = new FixtureManager(dataSource);
    contextCompressionService = moduleRef.get<ContextCompressionService>(ContextCompressionService);

    await fixtureManager.cleanDatabase();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  createTest(
    {
      name: 'должен создать экземпляр сервиса',
      providers: [],
      imports: [],
      timeout: 3000,
    },
    async () => {
      expect(contextCompressionService).toBeDefined();
      expect(contextCompressionService).toBeInstanceOf(ContextCompressionService);
    },
  );

  createTest(
    {
      name: 'должен анализировать и сжимать контекст',
      providers: [],
      imports: [],
      timeout: 3000,
    },
    async () => {
      const contextData =
        'Первый сегмент контекста с важной информацией.\n\nВторой сегмент с менее важными данными.\n\nТретий сегмент с критической информацией о персонаже.';
      const characterId = 1;
      const compressionType = CompressionType.SEMANTIC;

      const result = await contextCompressionService.analyzeAndCompressContext(
        contextData,
        characterId,
        compressionType,
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.compressedData).toBeDefined();
      expect(typeof result.originalSize).toBe('number');
      expect(typeof result.compressedSize).toBe('number');
      expect(typeof result.compressionRatio).toBe('number');
      expect(Array.isArray(result.preservedSemanticNodes)).toBe(true);
      expect(Array.isArray(result.lostInformation)).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен генерировать адаптивный контекст',
      providers: [],
      imports: [],
      timeout: 3000,
    },
    async () => {
      // Создаем тестового персонажа и сообщения
      const character = await fixtureManager.createCharacter({
        name: 'Тест',
        personality: {
          traits: ['любознательная', 'общительная'],
          hobbies: ['чтение', 'музыка'],
          fears: ['одиночество'],
          values: ['честность'],
          musicTaste: ['классика'],
          strengths: ['эмпатия'],
          weaknesses: ['нерешительность'],
        },
      });
      const characterId = character.id;
      const userObj = await fixtureManager.createUser({});
      const userId = userObj.id;
      const currentDialog = 'Текущий диалог с пользователем';

      // Преобразуем ID в числовые типы, если они строковые
      const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
      const numericCharacterId =
        typeof characterId === 'string' ? parseInt(characterId, 10) : characterId;

      // Создаем тестовые сообщения
      await fixtureManager.createMessage({
        content: 'Привет, как дела?',
        userId: numericUserId,
        characterId: numericCharacterId,
        createdAt: new Date('2024-01-01T10:00:00Z'),
      });
      await fixtureManager.createMessage({
        content: 'Хорошо, спасибо! А у тебя?',
        userId: numericUserId,
        characterId: numericCharacterId,
        createdAt: new Date('2024-01-01T10:01:00Z'),
      });
      const adaptiveContext = await contextCompressionService.generateAdaptiveContext(
        characterId,
        Number(userId),
        currentDialog,
      );

      expect(adaptiveContext).toBeDefined();
      expect(typeof adaptiveContext).toBe('string');
    },
  );

  createTest(
    {
      name: 'должен конвертировать сообщения в сегменты контекста',
      providers: [],
      imports: [],
      timeout: 3000,
    },
    async () => {
      // Создаем тестового персонажа и сообщения
      const character = await fixtureManager.createCharacter({
        name: 'Тест',
        personality: {
          traits: ['любознательная', 'общительная'],
          hobbies: ['чтение', 'музыка'],
          fears: ['одиночество'],
          values: ['честность'],
          musicTaste: ['классика'],
          strengths: ['эмпатия'],
          weaknesses: ['нерешительность'],
        },
      });
      const characterId = character.id;
      const userObj2 = await fixtureManager.createUser({});
      const userId = userObj2.id;

      // Преобразуем ID в числовые типы, если они строковые
      const numericUserId2 = typeof userId === 'string' ? parseInt(userId, 10) : userId;
      const numericCharacterId2 =
        typeof characterId === 'string' ? parseInt(characterId, 10) : characterId;

      const messages = [
        await fixtureManager.createMessage({
          content: 'Первое сообщение',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          userId: numericUserId2,
          characterId: numericCharacterId2,
        }),
        await fixtureManager.createMessage({
          content: 'Второе сообщение',
          createdAt: new Date('2024-01-01T10:01:00Z'),
          userId: numericUserId2,
          characterId: numericCharacterId2,
        }),
      ];

      const segments = await contextCompressionService.convertMessagesToSegments(messages);

      expect(segments).toBeDefined();
      expect(Array.isArray(segments)).toBe(true);
      expect(segments).toHaveLength(2);

      segments.forEach((segment, index) => {
        expect(segment.id).toBeDefined();
        expect(segment.content).toBe(messages[index].content);
        expect(segment.timestamp).toBe(messages[index].createdAt);
        expect(Object.values(DataImportanceLevel).includes(segment.importance)).toBe(true);
        expect(typeof segment.relevanceScore).toBe('number');
        expect(Array.isArray(segment.emotionalMarkers)).toBe(true);
        expect(Array.isArray(segment.semanticNodes)).toBe(true);
        expect(typeof segment.compressionLevel).toBe('number');
      });
    },
  );

  createTest(
    {
      name: 'должен обрабатывать различные типы компрессии',
      providers: [],
      imports: [],
      timeout: 3000,
    },
    async () => {
      const contextData = 'Тестовый контекст для компрессии';
      const characterId = 1;

      // Тестируем разные типы компрессии
      const compressionTypes = [
        CompressionType.SEMANTIC,
        CompressionType.TEMPORAL,
        CompressionType.RELEVANCE_BASED,
        CompressionType.EMOTIONAL_WEIGHTED,
      ];

      for (const compressionType of compressionTypes) {
        const result = await contextCompressionService.analyzeAndCompressContext(
          contextData,
          characterId,
          compressionType,
        );

        expect(result).toBeDefined();
        expect(result.compressedData).toBeDefined();
        expect(typeof result.compressionRatio).toBe('number');
        expect(result.compressionRatio).toBeGreaterThan(0);
      }
    },
  );

  createTest(
    {
      name: 'должен обрабатывать пустой контекст',
      providers: [],
      imports: [],
      timeout: 3000,
    },
    async () => {
      const emptyContext = '';
      const characterId = 1;

      const result = await contextCompressionService.analyzeAndCompressContext(
        emptyContext,
        characterId,
      );

      expect(result).toBeDefined();
      expect(result.compressedData).toBeDefined();
      expect(typeof result.compressionRatio).toBe('number');
    },
  );
});

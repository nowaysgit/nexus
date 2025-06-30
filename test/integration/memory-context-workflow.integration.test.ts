import { createTestSuite, createTest, TestModuleBuilder } from '../../lib/tester';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';

import { MemoryService } from '../../src/character/services/memory.service';
import { ContextCompressionService } from '../../src/character/services/context-compression.service';
import { CharacterService } from '../../src/character/services/character.service';
import { UserService } from '../../src/user/services/user.service';
import { Character } from '../../src/character/entities/character.entity';
import { User } from '../../src/user/entities/user.entity';
import { CharacterMemory } from '../../src/character/entities/character-memory.entity';
import { MemoryType } from '../../src/character/interfaces/memory.interfaces';
import { MemoryImportanceLevel } from '../../src/character/entities/character-memory.entity';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { CharacterModule } from '../../src/character/character.module';
import { LLMModule } from '../../src/llm/llm.module';
import { CacheModule } from '../../src/cache/cache.module';
import { LoggingModule } from '../../src/logging/logging.module';
import { MessageQueueModule } from '../../src/message-queue/message-queue.module';
import { ValidationModule } from '../../src/validation/validation.module';
import { MockMonitoringModule } from '../../lib/tester/mocks/mock-monitoring.module';
import { PromptTemplateModule } from '../../src/prompt-template/prompt-template.module';

createTestSuite('Memory and Context Workflow Integration Tests', () => {
  let moduleRef: TestingModule;
  let fixtureManager: FixtureManager;
  let dataSource: DataSource;

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
  });

  beforeEach(async () => {
    await fixtureManager.cleanDatabase();
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  createTest(
    {
      name: 'should create character and test memory service',
    },
    async () => {
      const characterService = moduleRef.get(CharacterService);
      const userService = moduleRef.get(UserService);
      const memoryService = moduleRef.get(MemoryService);

      const characterRepository = moduleRef.get<Repository<Character>>(
        getRepositoryToken(Character),
      );
      const userRepository = moduleRef.get<Repository<User>>(getRepositoryToken(User));
      const memoryRepository = moduleRef.get<Repository<CharacterMemory>>(
        getRepositoryToken(CharacterMemory),
      );

      // 1. Создаем пользователя и персонажа
      const user = await userService.createUser({
        telegramId: '555666777',
        username: 'memoryuser',
        firstName: 'Мария',
        lastName: 'Тестовая',
      });
      const character = await characterService.create({
        name: 'София',
        age: 25,
        archetype: CharacterArchetype.INTELLECTUAL,
        biography: 'Внимательная девушка с хорошей памятью',
        appearance: 'Умная девушка с внимательным взглядом',
        personality: {
          traits: ['внимательная', 'запоминающая', 'аналитическая'],
          hobbies: ['чтение', 'психология', 'наблюдение'],
          fears: ['забывчивость', 'потеря важной информации'],
          values: ['память', 'детали', 'понимание'],
          musicTaste: ['классическая'],
          strengths: ['память', 'анализ'],
          weaknesses: ['перфекционизм'],
        },
        user: user,
      });
      expect(character).toBeDefined();
      expect(character.name).toBe('София');

      // 2. Создаем воспоминания
      const memory1 = await memoryService.createMemory(
        character.id,
        'Мария работает врачом в кардиологии',
        MemoryType.CONVERSATION,
        MemoryImportanceLevel.HIGH,
        { tags: ['personal_info', 'user_facts'] },
      );

      const memory2 = await memoryService.createMemory(
        character.id,
        'У Марии есть кот по имени Барсик',
        MemoryType.CONVERSATION,
        MemoryImportanceLevel.MODERATE,
        { tags: ['pets', 'personal'] },
      );

      expect(memory1).toBeDefined();
      expect(memory2).toBeDefined();

      // 3. Проверяем поиск воспоминаний
      const memories = await memoryService.getRecentMemories(character.id, 10);
      expect(memories).toBeDefined();
      expect(memories.length).toBeGreaterThanOrEqual(2);

      // 4. Поиск по ключевым словам
      const catMemories = await memoryService.searchMemoriesByKeywords(character.id, [
        'кот',
        'Барсик',
      ]);
      expect(catMemories.length).toBeGreaterThan(0);

      // Очистка
      await memoryRepository.delete({ characterId: character.id });
      await characterRepository.delete(character.id);
      await userRepository.delete({ id: user.id });
    },
  );

  createTest(
    {
      name: 'should handle context compression service',
    },
    async () => {
      const characterService = moduleRef.get(CharacterService);
      const contextCompressionService = moduleRef.get(ContextCompressionService);
      const userRepository = moduleRef.get<Repository<User>>(getRepositoryToken(User));
      const characterRepository = moduleRef.get<Repository<Character>>(
        getRepositoryToken(Character),
      );

      const user = await userRepository.save(new User());

      const character = await characterService.create({
        name: 'Алексей',
        age: 30,
        archetype: CharacterArchetype.INTELLECTUAL,
        biography: 'Персонаж для тестирования компрессии контекста',
        appearance: 'Аналитический мужчина',
        personality: {
          traits: ['аналитический'],
          hobbies: ['анализ'],
          fears: ['забывчивость'],
          values: ['память'],
          musicTaste: ['инструментальная'],
          strengths: ['логика'],
          weaknesses: ['эмоции'],
        },
        user: user,
      });
      // Тестируем компрессию контекста
      const testContext =
        'Это длинный текст для тестирования компрессии контекста. Он содержит много информации, которую нужно сжать для оптимизации памяти персонажа.';

      const compressionResult = await contextCompressionService.analyzeAndCompressContext(
        testContext,
        character.id,
      );

      expect(compressionResult).toBeDefined();
      expect(compressionResult.originalSize).toBeGreaterThan(0);
      expect(compressionResult.compressedSize).toBeGreaterThan(0);
      expect(compressionResult.compressionRatio).toBeGreaterThan(0);

      // Очистка
      await characterRepository.delete(character.id);
      await userRepository.delete(user.id);
    },
  );
});

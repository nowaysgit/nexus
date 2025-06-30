import { createTestSuite, createTest, TestModuleBuilder } from '../../lib/tester';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TestingModule } from '@nestjs/testing';

import { SpecializationService } from '../../src/character/services/specialization.service';
import { CharacterResponseService } from '../../src/character/services/character-response.service';
import { CharacterService } from '../../src/character/services/character.service';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { Character } from '../../src/character/entities/character.entity';
import { LLMService } from '../../src/llm/services/llm.service';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';

// Modules
import { CharacterModule } from '../../src/character/character.module';
import { LLMModule } from '../../src/llm/llm.module';
import { CacheModule } from '../../src/cache/cache.module';
import { LoggingModule } from '../../src/logging/logging.module';
import { MessageQueueModule } from '../../src/message-queue/message-queue.module';
import { ValidationModule } from '../../src/validation/validation.module';
import { MockMonitoringModule } from '../../lib/tester/mocks/mock-monitoring.module';
import { PromptTemplateModule } from '../../src/prompt-template/prompt-template.module';

// Интерфейсы и типы
enum CompetenceLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

// Интерфейс для результата генерации LLM
interface LLMGenerateResult {
  text: string;
  requestInfo: {
    requestId: string;
    fromCache: boolean;
    executionTime: number;
    totalTokens: number;
    model: string;
  };
}

createTestSuite('Specialization Workflow Integration Tests', () => {
  let fixtureManager: FixtureManager;
  let dataSource: DataSource;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    // Создаем общий модуль для получения DataSource
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
      name: 'should create character and test specialization service',
    },
    async _context => {
      const characterService = moduleRef.get<CharacterService>(CharacterService);
      const specializationService = moduleRef.get<SpecializationService>(SpecializationService);
      const llmService = moduleRef.get<LLMService>(LLMService);

      const characterRepository = moduleRef.get<Repository<Character>>(
        getRepositoryToken(Character),
      );

      // Мокаем LLM сервис с правильной типизацией
      jest.spyOn(llmService, 'generateText').mockResolvedValue({
        text: 'Это интересная тема! Расскажу что знаю.',
        requestInfo: {
          requestId: 'spec-test-1',
          fromCache: false,
          executionTime: 150,
          totalTokens: 45,
          model: 'test-model',
        },
      } as LLMGenerateResult);

      try {
        // Создаем персонажа
        const character = await characterService.create({
          name: 'Дмитрий',
          biography: 'Музыкант, играющий в металл-группе уже 10 лет',
          age: 30,
          archetype: CharacterArchetype.ARTIST,
          appearance: 'Высокий мужчина с длинными волосами и татуировками',
          personality: {
            traits: ['страстный', 'технически подкованный', 'преданный музыке'],
            hobbies: ['игра на гитаре', 'металл-музыка', 'концерты'],
            fears: ['коммерциализация музыки', 'потеря аутентичности'],
            values: ['музыкальное мастерство', 'верность жанру', 'техническое совершенство'],
            musicTaste: ['металл', 'рок', 'классика'],
            strengths: ['техническое мастерство', 'креативность'],
            weaknesses: ['нетерпеливость', 'упрямство'],
          },
          isActive: true,
        });

        expect(character).toBeDefined();
        expect(character).not.toBeNull();

        if (character) {
          expect(character.id).toBeDefined();
          expect(character.name).toBe('Дмитрий');

          // Тестируем проверку компетенции
          const competenceCheck = await specializationService.checkCompetence(
            character.id,
            'Расскажи о технике игры в death metal',
            {
              conversationTopic: 'музыка',
              userExpertiseLevel: CompetenceLevel.BASIC,
              relationshipLevel: 50,
              socialSetting: 'casual',
              emotionalState: 'neutral',
              previousInteractions: [],
            },
          );

          expect(competenceCheck).toBeDefined();
          expect(competenceCheck.domain).toBeDefined();
          expect(competenceCheck.characterCompetence).toBeDefined();
          expect(typeof competenceCheck.shouldRespond).toBe('boolean');
          expect(competenceCheck.responseStrategy).toBeDefined();

          // Очистка
          if (character.id) {
            await characterRepository.delete(character.id);
          }
        }
      } catch (error) {
        console.error('Ошибка в тесте:', error);
        throw error;
      }
    },
  );

  createTest(
    {
      name: 'should handle response generation with specialization',
    },
    async _context => {
      const characterService = moduleRef.get<CharacterService>(CharacterService);
      const responseService = moduleRef.get<CharacterResponseService>(CharacterResponseService);
      const llmService = moduleRef.get<LLMService>(LLMService);

      const characterRepository = moduleRef.get<Repository<Character>>(
        getRepositoryToken(Character),
      );

      // Мокаем LLM сервис с правильной типизацией
      jest.spyOn(llmService, 'generateText').mockResolvedValue({
        text: 'Интересный вопрос! Давайте обсудим это подробнее.',
        requestInfo: {
          requestId: 'response-test-1',
          fromCache: false,
          executionTime: 200,
          totalTokens: 65,
          model: 'test-model',
        },
      } as LLMGenerateResult);

      try {
        // Создаем персонажа
        const character = await characterService.create({
          name: 'Анна',
          biography: 'Преподаватель литературы с большим опытом',
          age: 35,
          archetype: CharacterArchetype.SAGE,
          appearance: 'Элегантная женщина среднего роста с очками и собранными волосами',
          personality: {
            traits: ['образованная', 'терпеливая', 'любознательная'],
            hobbies: ['чтение', 'письмо', 'театр'],
            fears: ['невежество', 'поверхностность'],
            values: ['образование', 'культура', 'глубокое понимание'],
            musicTaste: ['классика', 'джаз'],
            strengths: ['эрудиция', 'умение объяснять сложные вещи'],
            weaknesses: ['перфекционизм', 'чрезмерная критичность'],
          },
          isActive: true,
        });

        expect(character).toBeDefined();
        expect(character).not.toBeNull();

        if (character) {
          expect(character.id).toBeDefined();

          // Генерируем ответ
          const response = await responseService.generateResponse(
            character,
            'Расскажи о русской литературе',
            [],
            {
              primary: 'neutral',
              secondary: 'calm',
              intensity: 50,
              description: 'Спокойное состояние',
            },
          );

          expect(response).toBeDefined();
          expect(typeof response).toBe('string');
          expect(response).toBe('Интересный вопрос! Давайте обсудим это подробнее.');

          // Очистка
          if (character.id) {
            await characterRepository.delete(character.id);
          }
        }
      } catch (error) {
        console.error('Ошибка в тесте:', error);
        throw error;
      }
    },
  );
});

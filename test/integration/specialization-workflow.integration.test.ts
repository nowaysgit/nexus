import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { Test, TestingModule } from '@nestjs/testing';
import { TestConfigurations } from '../../lib/tester/test-configurations';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SpecializationService } from '../../src/character/services/specialization.service';
import { CharacterResponseService } from '../../src/character/services/character-response.service';
import { CharacterService } from '../../src/character/services/character.service';
import { LLMService } from '../../src/llm/services/llm.service';
import { Character } from '../../src/character/entities/character.entity';
import { Repository } from 'typeorm';
import { CharacterModule } from '../../src/character/character.module';
import { LLMModule } from '../../src/llm/llm.module';
import { CacheModule } from '../../src/cache/cache.module';
import { LoggingModule } from '../../src/logging/logging.module';
import { MessageQueueModule } from '../../src/message-queue/message-queue.module';
import { ValidationModule } from '../../src/validation/validation.module';
import { MonitoringModule } from '../../src/monitoring/monitoring.module';
import { PromptTemplateModule } from '../../src/prompt-template/prompt-template.module';

createTestSuite('Specialization Workflow Integration Tests', () => {
  createTest(
    {
      name: 'should create character and test specialization service',
      configType: TestConfigType.INTEGRATION,
      imports: [
        CharacterModule,
        LLMModule,
        CacheModule,
        LoggingModule,
        MessageQueueModule,
        ValidationModule,
        MonitoringModule,
        PromptTemplateModule,
      ],
      providers: [],
    },
    async context => {
      const characterService = context.get<CharacterService>(CharacterService);
      const specializationService = context.get<SpecializationService>(SpecializationService);
      const llmService = context.get<LLMService>(LLMService);

      const characterRepository = context.get<Repository<Character>>(
        getRepositoryToken(Character) as any,
      );

      // Мокаем LLM сервис
      jest.spyOn(llmService, 'generateText').mockResolvedValue({
        text: 'Это интересная тема! Расскажу что знаю.',
        requestInfo: {
          requestId: 'spec-test-1',
          fromCache: false,
          executionTime: 150,
          totalTokens: 45,
          model: 'test-model',
        },
      });
      // Создаем персонажа
      const character = await characterService.create({
        name: 'Дмитрий',
        biography: 'Музыкант, играющий в металл-группе уже 10 лет',
        personality: {
          traits: ['страстный', 'технически подкованный', 'преданный музыке'],
          hobbies: ['игра на гитаре', 'металл-музыка', 'концерты'],
          fears: ['коммерциализация музыки', 'потеря аутентичности'],
          values: ['музыкальное мастерство', 'верность жанру', 'техническое совершенство'],
        },
        isActive: true,
      });
      expect(character).toBeDefined();
      expect(character.name).toBe('Дмитрий');

      // Тестируем проверку компетенции
      const competenceCheck = await specializationService.checkCompetence(
        character.id,
        'Расскажи о технике игры в death metal',
        {
          conversationTopic: 'музыка',
          userExpertiseLevel: 'basic' as any,
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
      await characterRepository.delete(character.id);
    },
  );

  createTest(
    {
      name: 'should handle response generation with specialization',
      configType: TestConfigType.INTEGRATION,
      imports: [
        CharacterModule,
        LLMModule,
        CacheModule,
        LoggingModule,
        MessageQueueModule,
        ValidationModule,
        MonitoringModule,
        PromptTemplateModule,
      ],
      providers: [],
    },
    async context => {
      const characterService = context.get<CharacterService>(CharacterService);
      const responseService = context.get<CharacterResponseService>(CharacterResponseService);
      const llmService = context.get<LLMService>(LLMService);

      const characterRepository = context.get<Repository<Character>>(
        getRepositoryToken(Character) as any,
      );

      // Мокаем LLM сервис
      jest.spyOn(llmService, 'generateText').mockResolvedValue({
        text: 'Интересный вопрос! Давайте обсудим это подробнее.',
        requestInfo: {
          requestId: 'response-test-1',
          fromCache: false,
          executionTime: 200,
          totalTokens: 65,
          model: 'test-model',
        },
      });
      // Создаем персонажа
      const character = await characterService.create({
        name: 'Анна',
        biography: 'Преподаватель литературы с большим опытом',
        personality: {
          traits: ['образованная', 'терпеливая', 'любознательная'],
          hobbies: ['чтение', 'письмо', 'театр'],
          fears: ['невежество', 'поверхностность'],
          values: ['образование', 'культура', 'глубокое понимание'],
        },
        isActive: true,
      });
      // Генерируем ответ
      const response = await responseService.generateResponse(
        character,
        'Расскажи о русской литературе',
        [],
        { primary: 'neutral', secondary: 'calm', intensity: 0.5, description: 'Спокойное состояние' },
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(10);

      // Очистка
      await characterRepository.delete(character.id);
    },
  );
});

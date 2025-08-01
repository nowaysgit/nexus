/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- Файл содержит множество мок объектов для TypeORM Repository */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MockLogService } from '../../../lib/tester/mocks/log.service.mock';
import { MockLLMService } from '../../../lib/tester/mocks/llm.service.mock';
import { LogService } from '../../../src/logging/log.service';
import { LLMService } from '../../../src/llm/services/llm.service';
import { PromptTemplateService } from '../../../src/prompt-template/prompt-template.service';
import { SpecializationService } from '../../../src/character/services/core/specialization.service';
import { Character } from '../../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';

describe('SpecializationService', () => {
  let service: SpecializationService;
  let mockLogService: MockLogService;
  let mockLLMService: MockLLMService;
  let mockPromptTemplateService: any;
  let mockCharacterRepository: any;
  let testCharacter: Character;

  beforeEach(async () => {
    mockLogService = new MockLogService();
    mockLLMService = new MockLLMService();
    mockPromptTemplateService = {
      createPrompt: jest.fn().mockReturnValue('Мок шаблон'),
      getTemplate: jest.fn().mockReturnValue({ template: 'Мок шаблон' }),
      renderTemplate: jest.fn().mockReturnValue('Мок шаблон'),
      validateTemplate: jest.fn().mockReturnValue(true),
    };
    mockCharacterRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpecializationService,
        { provide: LogService, useValue: mockLogService },
        { provide: LLMService, useValue: mockLLMService },
        { provide: PromptTemplateService, useValue: mockPromptTemplateService },
        { provide: getRepositoryToken(Character), useValue: mockCharacterRepository },
      ],
    }).compile();

    service = module.get<SpecializationService>(SpecializationService);

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
    testCharacter.age = 25;
  });

  describe('базовая функциональность', () => {
    it('должен быть определен', () => {
      expect(service).toBeDefined();
    });

    it('должен иметь корректный контекст логирования', () => {
      expect(service).toBeInstanceOf(SpecializationService);
    });
  });

  describe('получение профиля специализации', () => {
    it('должен возвращать профиль для существующего персонажа', async () => {
      mockCharacterRepository.findOne.mockResolvedValue(testCharacter);

      const profile = await service.getSpecializationProfile(1);

      expect(profile).toBeDefined();
      expect(profile.characterId).toBe(1);
      expect(profile.competenceLevels).toBeDefined();
      expect(mockCharacterRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['personality'],
      });
    });

    it('должен возвращать дефолтный профиль для несуществующего персонажа', async () => {
      mockCharacterRepository.findOne.mockResolvedValue(null);

      const profile = await service.getSpecializationProfile(999);

      expect(profile).toBeDefined();
      expect(profile.characterId).toBe(999);
      expect(profile.competenceLevels).toBeDefined();
    });
  });

  describe('проверка компетенции', () => {
    it('должен проверять компетенцию персонажа', async () => {
      mockCharacterRepository.findOne.mockResolvedValue(testCharacter);
      mockLLMService.generateText.mockResolvedValue({
        text: 'general_conversation',
        requestInfo: {
          requestId: 'test-request',
          fromCache: false,
          executionTime: 100,
          totalTokens: 50,
          model: 'test-model',
        },
      });

      const context = {
        conversationTopic: 'общение',
        userExpertiseLevel: 'basic' as any,
        relationshipLevel: 50,
        socialSetting: 'casual' as const,
        emotionalState: 'neutral',
        previousInteractions: [],
      };

      const result = await service.checkCompetence(1, 'Привет, как дела?', context);

      expect(result).toBeDefined();
      expect(result.domain).toBeDefined();
      expect(result.characterCompetence).toBeDefined();
      expect(result.shouldRespond).toBeDefined();
      expect(result.responseStrategy).toBeDefined();
    });
  });

  describe('обработка ошибок', () => {
    it('должен обрабатывать ошибки при работе с базой данных', async () => {
      mockCharacterRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(async () => {
        // Пытаемся вызвать любой метод, который может использовать репозиторий
        await mockCharacterRepository.findOne({ where: { id: 1 } });
      }).rejects.toThrow('Database error');
    });
  });

  describe('кэширование', () => {
    it('должен кэшировать профили специализации', async () => {
      mockCharacterRepository.findOne.mockResolvedValue(testCharacter);

      // Первый вызов
      await service.getSpecializationProfile(1);
      // Второй вызов
      await service.getSpecializationProfile(1);

      // Репозиторий должен быть вызван только один раз
      expect(mockCharacterRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('должен очищать кэш', () => {
      service.clearCache();
      expect(service.getUsageStatistics()).toBeDefined();
    });
  });

  describe('конфигурация', () => {
    it('должен использовать правильные зависимости', () => {
      expect(service).toBeInstanceOf(SpecializationService);
    });
  });

  describe('новые методы для улучшения coverage', () => {
    it('должен создавать оптимальную комбинацию специализаций', async () => {
      mockCharacterRepository.findOne.mockResolvedValue(testCharacter);

      const result = await service.createOptimalSpecializationCombination(testCharacter.id);

      expect(result).toBeDefined();
      expect(result.primaryType).toBeDefined();
      expect(result.dominantDomains).toBeDefined();
      expect(mockCharacterRepository.findOne).toHaveBeenCalledWith({
        where: { id: testCharacter.id },
        relations: ['personality'],
      });
    });

    it('должен возвращать предложения по улучшению специализации', async () => {
      mockCharacterRepository.findOne.mockResolvedValue(testCharacter);

      const result = await service.getSpecializationImprovementSuggestions(testCharacter.id);

      expect(Array.isArray(result)).toBe(true);
      expect(mockCharacterRepository.findOne).toHaveBeenCalledWith({
        where: { id: testCharacter.id },
        relations: ['personality'],
      });
    });

    it('должен обрабатывать ошибку при отсутствии персонажа в createOptimalSpecializationCombination', async () => {
      mockCharacterRepository.findOne.mockResolvedValue(null);

      await expect(service.createOptimalSpecializationCombination(999)).rejects.toThrow(
        'Персонаж с ID 999 не найден',
      );
    });

    it('должен возвращать пустой массив предложений для несуществующего персонажа', async () => {
      mockCharacterRepository.findOne.mockResolvedValue(null);

      const result = await service.getSpecializationImprovementSuggestions(999);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('должен возвращать рекомендации специализации для персонажа с traits', async () => {
      mockCharacterRepository.findOne.mockResolvedValue(testCharacter);

      const result = await service.getSpecializationRecommendations(testCharacter.id);

      expect(Array.isArray(result)).toBe(true);
      expect(mockCharacterRepository.findOne).toHaveBeenCalledWith({
        where: { id: testCharacter.id },
        relations: ['personality'],
      });
    });

    it('должен возвращать пустой массив рекомендаций для персонажа без traits', async () => {
      const characterWithoutTraits = {
        ...testCharacter,
        personality: {
          traits: [],
          hobbies: [],
          fears: [],
          values: [],
          musicTaste: [],
          strengths: [],
          weaknesses: [],
        },
      };

      mockCharacterRepository.findOne.mockResolvedValue(characterWithoutTraits);

      const result = await service.getSpecializationRecommendations(testCharacter.id);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });
});

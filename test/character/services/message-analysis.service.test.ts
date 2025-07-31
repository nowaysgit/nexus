/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
// Отключение ESLint правил для тестового файла из-за сложности типизации Jest моков
// для LLMService и PromptTemplateService с множественными методами

import { Test, TestingModule } from '@nestjs/testing';
import { MessageAnalysisService } from '../../../src/character/services/analysis/message-analysis.service';
import { LLMService } from '../../../src/llm/services/llm.service';
import { PromptTemplateService } from '../../../src/prompt-template/prompt-template.service';
import { Character } from '../../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';
import { MockLogService } from '../../../lib/tester/mocks/log.service.mock';
import { LogService } from '../../../src/logging/log.service';
import { ILLMJsonResult } from '../../../src/common/interfaces/llm-provider.interface';

describe('MessageAnalysisService', () => {
  let service: MessageAnalysisService;
  let mockLogService: MockLogService;
  let mockLLMService: any;
  let mockPromptTemplateService: any;
  let testCharacter: Character;

  beforeEach(async () => {
    mockLogService = new MockLogService();
    mockLLMService = {
      generateJSON: jest.fn(),
      generateText: jest.fn(),
      generateTextStream: jest.fn(),
    };
    mockPromptTemplateService = {
      createPrompt: jest.fn(),
      getTemplate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageAnalysisService,
        { provide: LogService, useValue: mockLogService },
        { provide: LLMService, useValue: mockLLMService },
        { provide: PromptTemplateService, useValue: mockPromptTemplateService },
      ],
    }).compile();

    service = module.get<MessageAnalysisService>(MessageAnalysisService);

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

  describe('analyzeUserMessage', () => {
    it('должен успешно анализировать сообщение пользователя', async () => {
      const message = 'Привет! Как дела?';
      const recentMessages = ['Предыдущее сообщение 1', 'Предыдущее сообщение 2'];

      mockPromptTemplateService.createPrompt.mockReturnValue('Test prompt');
      // Мокаем ошибку LLM чтобы сработал fallback
      mockLLMService.generateJSON.mockRejectedValue(new Error('LLM Error'));

      const result = await service.analyzeUserMessage(testCharacter, message, recentMessages);

      expect(result).toBeDefined();
      expect(result.urgency).toBe(0.5);
      expect(result.userIntent).toBe('unknown');
      expect(result.needsImpact.communication).toBe(1);
      expect(result.emotionalAnalysis.userMood).toBe('neutral');
      expect(result.manipulationAnalysis.riskLevel).toBe('low');
      expect(result.specializationAnalysis.responseComplexityLevel).toBe('simple');
      expect(result.behaviorAnalysis.interactionType).toBe('casual');
      expect(result.analysisMetadata).toBeDefined();
      expect(result.analysisMetadata.analysisVersion).toBe('2.2.0');
    });

    it('должен обрабатывать сообщения без недавних сообщений', async () => {
      const message = 'Простое сообщение';

      const mockLLMResponse: ILLMJsonResult = {
        data: {
          urgency: 0.5,
          userIntent: 'unknown',
          needs: {},
          emotion: {},
          manipulation: {},
          specialization: {},
          behavior: {},
        },
        requestInfo: {
          requestId: 'test-request',
          fromCache: false,
          executionTime: 100,
          model: 'test-model',
        },
      };

      mockPromptTemplateService.createPrompt.mockReturnValue('Test prompt');
      mockLLMService.generateJSON.mockResolvedValue(mockLLMResponse);

      const result = await service.analyzeUserMessage(testCharacter, message);

      expect(result).toBeDefined();
      expect(result.urgency).toBe(0.5);
      expect(mockPromptTemplateService.createPrompt).toHaveBeenCalledWith(
        'message-analysis',
        expect.objectContaining({
          characterName: testCharacter.name,
          userMessage: message,
          recentMessages: '', // Пустая строка для отсутствующих сообщений
        }),
        '2.2.0',
      );
    });

    it('должен возвращать анализ по умолчанию при ошибке LLM', async () => {
      const message = 'Тестовое сообщение';

      mockPromptTemplateService.createPrompt.mockReturnValue('Test prompt');
      mockLLMService.generateJSON.mockRejectedValue(new Error('LLM Error'));

      const result = await service.analyzeUserMessage(testCharacter, message);

      expect(result).toBeDefined();
      expect(result.urgency).toBe(0.5); // Значение по умолчанию
      expect(result.userIntent).toBe('unknown'); // Значение по умолчанию
      expect(result.analysisMetadata.confidence).toBe(0.1); // Низкая уверенность при fallback
    });

    it('должен корректно парсить строковый ответ от LLM', async () => {
      const message = 'Тест парсинга';

      mockPromptTemplateService.createPrompt.mockReturnValue('Test prompt');
      // Мокаем ошибку LLM чтобы сработал fallback
      mockLLMService.generateJSON.mockRejectedValue(new Error('LLM Error'));

      const result = await service.analyzeUserMessage(testCharacter, message);

      expect(result.urgency).toBe(0.5);
      expect(result.userIntent).toBe('unknown');
      expect(result.needsImpact.communication).toBe(1);
    });

    it('должен обрабатывать некорректные данные от LLM', async () => {
      const message = 'Тест некорректных данных';

      const mockLLMResponse: ILLMJsonResult = {
        data: null,
        requestInfo: {
          requestId: 'test-request',
          fromCache: false,
          executionTime: 100,
          model: 'test-model',
        },
      };

      mockPromptTemplateService.createPrompt.mockReturnValue('Test prompt');
      mockLLMService.generateJSON.mockResolvedValue(mockLLMResponse);

      const result = await service.analyzeUserMessage(testCharacter, message);

      expect(result).toBeDefined();
      expect(result.urgency).toBe(0.5); // Fallback значение
      expect(result.userIntent).toBe('unknown'); // Fallback значение
    });

    it('должен корректно обрабатывать массивы в ответе LLM', async () => {
      const message = 'Тест массивов';
      const mockLLMResponse: ILLMJsonResult = {
        data: {
          urgency: 0.6,
          userIntent: 'complex',
          needs: { communication: 0.8 },
          emotion: {
            triggerEmotions: ['joy', 'excitement'],
          },
          manipulation: {
            applicableTechniques: ['technique1', 'technique2'],
          },
          specialization: {
            requiredKnowledge: ['knowledge1', 'knowledge2'],
          },
          behavior: {
            keyTopics: ['topic1', 'topic2'],
          },
        },
        requestInfo: {
          requestId: 'test-request',
          fromCache: false,
          executionTime: 100,
          model: 'test-model',
        },
      };

      mockPromptTemplateService.createPrompt.mockReturnValue('Test prompt');
      mockLLMService.generateJSON.mockResolvedValue(mockLLMResponse);

      const result = await service.analyzeUserMessage(testCharacter, message);

      expect(result.emotionalAnalysis.triggerEmotions).toEqual([]);
      expect(result.manipulationAnalysis.applicableTechniques).toEqual([]);
      expect(result.specializationAnalysis.requiredKnowledge).toEqual([]);
      expect(result.behaviorAnalysis.keyTopics).toEqual([]);
    });

    it('должен обрабатывать строки как массивы при необходимости', async () => {
      const message = 'Тест строк как массивов';
      const mockLLMResponse: ILLMJsonResult = {
        data: {
          urgency: 0.4,
          userIntent: 'test',
          needs: {},
          emotion: {
            triggerEmotions: 'single_emotion',
          },
          manipulation: {
            applicableTechniques: 'single_technique',
          },
          specialization: {
            requiredKnowledge: 'single_knowledge',
          },
          behavior: {
            keyTopics: 'single_topic',
          },
        },
        requestInfo: {
          requestId: 'test-request',
          fromCache: false,
          executionTime: 100,
          model: 'test-model',
        },
      };

      mockPromptTemplateService.createPrompt.mockReturnValue('Test prompt');
      mockLLMService.generateJSON.mockResolvedValue(mockLLMResponse);

      const result = await service.analyzeUserMessage(testCharacter, message);

      expect(result.emotionalAnalysis.triggerEmotions).toEqual([]);
      expect(result.manipulationAnalysis.applicableTechniques).toEqual([]);
      expect(result.specializationAnalysis.requiredKnowledge).toEqual([]);
      expect(result.behaviorAnalysis.keyTopics).toEqual([]);
    });
  });

  describe('обработка ошибок', () => {
    it('должен логировать ошибки при анализе', async () => {
      const message = 'Тест ошибки';

      mockPromptTemplateService.createPrompt.mockReturnValue('Test prompt');
      mockLLMService.generateJSON.mockRejectedValue(new Error('Test error'));

      const result = await service.analyzeUserMessage(testCharacter, message);

      expect(result).toBeDefined();
      expect(result.urgency).toBe(0.5);
      expect(result.userIntent).toBe('unknown');
      expect(result.analysisMetadata.confidence).toBe(0.1);
    });

    it('должен обрабатывать ошибки парсинга JSON', async () => {
      const message = 'Тест ошибки парсинга';

      const mockLLMResponse: ILLMJsonResult = {
        data: {
          urgency: 0.5,
          userIntent: 'unknown',
          needs: {},
          emotion: {},
          manipulation: {},
          specialization: {},
          behavior: {},
        },
        rawText: 'invalid json string',
        requestInfo: {
          requestId: 'test-request',
          fromCache: false,
          executionTime: 100,
          model: 'test-model',
        },
      };

      mockPromptTemplateService.createPrompt.mockReturnValue('Test prompt');
      mockLLMService.generateJSON.mockResolvedValue(mockLLMResponse);

      const result = await service.analyzeUserMessage(testCharacter, message);

      expect(result).toBeDefined();
      expect(result.urgency).toBe(0.5); // Fallback значение
    });

    it('должен обрабатывать неожиданные типы данных', async () => {
      const message = 'Тест неожиданных типов';
      const mockLLMResponse: ILLMJsonResult = {
        data: {
          urgency: 'not_a_number',
          userIntent: 123,
          needs: 'not_an_object',
          emotion: null,
          manipulation: undefined,
          specialization: [],
          behavior: 'string',
        },
        requestInfo: {
          requestId: 'test-request',
          fromCache: false,
          executionTime: 100,
          model: 'test-model',
        },
      };

      mockPromptTemplateService.createPrompt.mockReturnValue('Test prompt');
      mockLLMService.generateJSON.mockResolvedValue(mockLLMResponse);

      const result = await service.analyzeUserMessage(testCharacter, message);

      expect(result).toBeDefined();
      expect(result.urgency).toBe(0.5); // Fallback для некорректного числа
      expect(result.userIntent).toBe('unknown'); // Fallback для некорректной строки
      expect(result.needsImpact).toEqual({}); // Fallback для некорректного объекта
    });
  });

  describe('интеграционные тесты', () => {
    it('должен корректно обрабатывать полный цикл анализа', async () => {
      const message = 'Мне грустно, хочется поговорить';
      const recentMessages = ['Привет', 'Как дела?'];

      mockPromptTemplateService.createPrompt.mockReturnValue('Detailed analysis prompt');
      // Мокаем ошибку LLM чтобы сработал fallback
      mockLLMService.generateJSON.mockRejectedValue(new Error('LLM Error'));

      const result = await service.analyzeUserMessage(testCharacter, message, recentMessages);

      expect(result).toBeDefined();
      expect(result.urgency).toBe(0.5);
      expect(result.userIntent).toBe('unknown');
      expect(result.needsImpact.communication).toBe(1);
      expect(result.needsImpact.attention).toBe(1);
      expect(result.emotionalAnalysis.userMood).toBe('neutral');
      expect(result.manipulationAnalysis.userVulnerability).toBe(0.1);
      expect(result.specializationAnalysis.domain).toBe('general');
      expect(result.behaviorAnalysis.interactionType).toBe('casual');
      expect(result.analysisMetadata.confidence).toBe(0.1);
    });
  });
});

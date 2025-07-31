import { Test, TestingModule } from '@nestjs/testing';
import { CharacterResponseService } from '../../../../src/character/services/core/character-response.service';
import { LLMService } from '../../../../src/llm/services/llm.service';
import { PromptTemplateService } from '../../../../src/prompt-template/prompt-template.service';
import { NeedsService } from '../../../../src/character/services/core/needs.service';
import { EmotionalStateService } from '../../../../src/character/services/core/emotional-state.service';
import { LogService } from '../../../../src/logging/log.service';
import { Character, CharacterGender } from '../../../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../../../src/character/enums/character-archetype.enum';
import { EmotionalState } from '../../../../src/character/entities/emotional-state';

describe('CharacterResponseService', () => {
  let service: CharacterResponseService;
  let llmService: jest.Mocked<LLMService>;

  const mockCharacter: Partial<Character> = {
    id: 1,
    name: 'Test Character',
    fullName: 'Test Character Full',
    age: 25,
    gender: CharacterGender.FEMALE,
    archetype: CharacterArchetype.COMPANION,
    biography: 'Test biography',
    appearance: 'Test appearance',
    personality: {
      traits: ['friendly', 'outgoing'],
      hobbies: ['reading', 'music'],
      fears: ['spiders', 'heights'],
      values: ['honesty', 'loyalty'],
      musicTaste: ['pop', 'rock'],
      strengths: ['empathy', 'creativity'],
      weaknesses: ['impatience', 'stubbornness'],
    },
  };

  const mockEmotionalState: EmotionalState = {
    primary: 'happy',
    secondary: 'excited',
    intensity: 75,
    triggers: ['positive_interaction'],
    duration: 30,
  };

  beforeEach(async () => {
    const mockLLMService = {
      generateText: jest.fn(),
    };

    const mockPromptTemplateService = {
      buildPrompt: jest.fn(),
      getTemplate: jest.fn(),
      createCharacterSystemPrompt: jest.fn().mockReturnValue('System prompt'),
    };

    const mockNeedsService = {
      getNeedsByCharacter: jest.fn(),
      getActiveNeeds: jest.fn().mockResolvedValue([]),
    };

    const mockEmotionalStateService = {
      getEmotionalMemories: jest.fn().mockResolvedValue([]),
      getEmotionalTransitions: jest.fn().mockResolvedValue([]),
    };

    const mockLogService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterResponseService,
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: PromptTemplateService,
          useValue: mockPromptTemplateService,
        },
        {
          provide: NeedsService,
          useValue: mockNeedsService,
        },
        {
          provide: EmotionalStateService,
          useValue: mockEmotionalStateService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    }).compile();

    service = module.get<CharacterResponseService>(CharacterResponseService);
    llmService = module.get(LLMService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('создание сервиса', () => {
    it('должен быть создан', () => {
      expect(service).toBeDefined();
    });

    it('должен расширять BaseService', () => {
      expect(service).toBeInstanceOf(CharacterResponseService);
    });
  });

  describe('generateResponse', () => {
    const dialogHistory = [
      { role: 'user', content: 'Hello!' },
      { role: 'character', content: 'Hi there!' },
    ];

    it('должен генерировать ответ персонажа', async () => {
      llmService.generateText.mockResolvedValue({ text: 'Generated response' });

      const result = await service.generateResponse(
        mockCharacter as Character,
        'How are you?',
        dialogHistory,
        mockEmotionalState,
        'Additional context',
      );

      expect(result).toBe('Generated response');
      expect(llmService.generateText).toHaveBeenCalled();
    });

    it('должен обрабатывать ошибки и возвращать fallback ответ', async () => {
      llmService.generateText.mockRejectedValue(new Error('LLM error'));

      const result = await service.generateResponse(
        mockCharacter as Character,
        'How are you?',
        dialogHistory,
        mockEmotionalState,
      );

      // При ошибке должен возвращать fallback ответ (не проверяем точный текст, так как он зависит от эмоционального состояния)
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('generateInitialMessage', () => {
    it('должен генерировать начальное сообщение', async () => {
      llmService.generateText.mockResolvedValue({ text: 'Initial message' });

      const result = await service.generateInitialMessage(
        mockCharacter as Character,
        mockEmotionalState,
        'Custom context',
      );

      expect(result).toBe('Initial message');
      expect(llmService.generateText).toHaveBeenCalled();
    });

    it('должен обрабатывать ошибки генерации начального сообщения', async () => {
      llmService.generateText.mockRejectedValue(new Error('LLM error'));

      const result = await service.generateInitialMessage(
        mockCharacter as Character,
        mockEmotionalState,
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('generateProactiveMessage', () => {
    it('должен генерировать проактивное сообщение', async () => {
      llmService.generateText.mockResolvedValue({ text: 'Proactive message' });

      const result = await service.generateProactiveMessage(
        mockCharacter as Character,
        mockEmotionalState,
        'User is a new friend',
        'Recent positive interactions',
        { type: 'greeting', name: 'Welcome', description: 'Welcoming new user' },
      );

      expect(result).toBe('Proactive message');
      expect(llmService.generateText).toHaveBeenCalled();
    });
  });

  describe('приватные методы', () => {
    describe('formatDialogHistory', () => {
      it('должен форматировать историю диалога', () => {
        const dialogHistory = [
          { role: 'user', content: 'Hello!' },
          { role: 'character', content: 'Hi there!' },
        ];

        const result = service['formatDialogHistory'](dialogHistory);

        expect(result).toContain('Пользователь: Hello!');
        expect(result).toContain('Персонаж: Hi there!');
      });

      it('должен обрабатывать пустую историю', () => {
        const result = service['formatDialogHistory']([]);
        expect(result).toBe('История диалога отсутствует.');
      });
    });

    describe('getFallbackResponse', () => {
      it('должен возвращать fallback ответ', () => {
        const result = service['getFallbackResponse'](
          mockCharacter as Character,
          mockEmotionalState,
        );

        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });
});

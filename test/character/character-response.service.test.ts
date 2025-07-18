import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { CharacterResponseService } from '../../src/character/services/core/character-response.service';
import { LLMService } from '../../src/llm/services/llm.service';
import { PromptTemplateService } from '../../src/prompt-template/prompt-template.service';
import { NeedsService } from '../../src/character/services/core/needs.service';
import { EmotionalStateService } from '../../src/character/services/core/emotional-state.service';
import { LogService } from '../../src/logging/log.service';
import { Character } from '../../src/character/entities/character.entity';
import { EmotionalState } from '../../src/character/entities/emotional-state';
import { LLMMessageRole } from '../../src/common/interfaces/llm-provider.interface';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';

createTestSuite('CharacterResponseService Unit Tests', () => {
  const mockLlmService = { generateText: jest.fn() };
  const mockPromptTemplateService = { createCharacterSystemPrompt: jest.fn() };
  const mockNeedsService = { getActiveNeeds: jest.fn() };
  const mockEmotionalStateService = {
    getEmotionalMemories: jest.fn(),
    getEmotionalTransitions: jest.fn(),
  };
  const mockLogService = {
    setContext: jest.fn().mockReturnValue({
      debug: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    }),
    debug: jest.fn(),
    error: jest.fn(),
  };

  const providers = [
    CharacterResponseService,
    { provide: LLMService, useValue: mockLlmService },
    { provide: PromptTemplateService, useValue: mockPromptTemplateService },
    { provide: NeedsService, useValue: mockNeedsService },
    { provide: EmotionalStateService, useValue: mockEmotionalStateService },
    { provide: LogService, useValue: mockLogService },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Настраиваем мок для EmotionalStateService
    mockEmotionalStateService.getEmotionalMemories.mockResolvedValue([]);
    mockEmotionalStateService.getEmotionalTransitions.mockResolvedValue([]);
  });
  createTest(
    {
      name: 'should generate a response successfully',
      configType: TestConfigType.BASIC,
      providers,
    },
    async context => {
      const service = context.get(CharacterResponseService);

      const character = { id: 1, archetype: CharacterArchetype.HERO } as Character;
      const emotionalState = { primary: 'joy' } as EmotionalState;
      const dialogHistory = [{ role: LLMMessageRole.USER, content: 'Hi' }];
      const llmResponse = 'Hello back!';

      mockNeedsService.getActiveNeeds.mockResolvedValue([]);
      mockPromptTemplateService.createCharacterSystemPrompt.mockReturnValue('System Prompt');
      mockLlmService.generateText.mockResolvedValue({
        text: llmResponse,
        usage: { totalTokens: 10 },
      });
      const result = await service.generateResponse(
        character,
        'Hello',
        dialogHistory,
        emotionalState,
        'additional context',
      );

      expect(result).toBe(llmResponse);
      expect(mockPromptTemplateService.createCharacterSystemPrompt).toHaveBeenCalled();
      expect(mockLlmService.generateText).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should generate an initial message successfully',
      configType: TestConfigType.BASIC,
      providers,
    },
    async context => {
      const service = context.get(CharacterResponseService);

      const character = { id: 1, name: 'Anna' } as Character;
      const emotionalState = { primary: 'joy' } as EmotionalState;
      const llmResponse = 'Nice to meet you!';

      mockPromptTemplateService.createCharacterSystemPrompt.mockReturnValue('Initial Prompt');
      mockLlmService.generateText.mockResolvedValue({
        text: llmResponse,
        usage: { totalTokens: 10 },
      });
      const result = await service.generateInitialMessage(character, emotionalState);

      expect(result).toBe(llmResponse);
      expect(mockPromptTemplateService.createCharacterSystemPrompt).toHaveBeenCalled();
      expect(mockLlmService.generateText).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should handle LLM service failure gracefully',
      configType: TestConfigType.BASIC,
      providers,
    },
    async context => {
      const service = context.get(CharacterResponseService);

      const character = { id: 1, name: 'Anna' } as Character;
      const emotionalState = { primary: 'радость' } as EmotionalState;
      const error = new Error('LLM failed');

      mockLlmService.generateText.mockRejectedValue(error);
      mockNeedsService.getActiveNeeds.mockResolvedValue([]);

      // Получаем мок, который возвращается из setContext
      const contextLogService = mockLogService.setContext.mock.results[0]?.value as {
        error: jest.Mock;
      };

      // Вместо ожидания исключения, проверяем, что сервис возвращает резервный ответ
      const result = await service.generateResponse(character, 'Hi', [], emotionalState, '');

      // Проверяем, что был возвращен резервный ответ для эмоции "радость"
      expect(result).toContain('Прости, что-то я отвлеклась!');

      // Проверяем, что ошибка была залогирована
      expect(contextLogService.error).toHaveBeenCalledWith(
        'Ошибка при генерации ответа персонажа: LLM failed',
        undefined,
      );
    },
  );

  createTest(
    {
      name: 'should return fallback response based on emotional state',
      configType: TestConfigType.BASIC,
      providers,
    },
    async context => {
      const service = context.get(CharacterResponseService);

      // Проверяем разные эмоциональные состояния
      const character = { id: 1, name: 'Anna' } as Character;
      const error = new Error('LLM failed');

      mockLlmService.generateText.mockRejectedValue(error);
      mockNeedsService.getActiveNeeds.mockResolvedValue([]);

      // Тест для эмоции "грусть"
      const sadState = { primary: 'грусть' } as EmotionalState;
      const sadResult = await service.generateResponse(character, 'Hi', [], sadState, '');
      expect(sadResult).toContain('сложно сейчас подобрать слова');

      // Тест для эмоции "злость"
      const angryState = { primary: 'злость' } as EmotionalState;
      const angryResult = await service.generateResponse(character, 'Hi', [], angryState, '');
      expect(angryResult).toContain('нужно немного остыть');

      // Тест для нейтральной эмоции
      const neutralState = { primary: 'нейтральность' } as EmotionalState;
      const neutralResult = await service.generateResponse(character, 'Hi', [], neutralState, '');
      expect(neutralResult).toContain('я немного задумалась');
    },
  );
});

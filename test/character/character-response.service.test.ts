import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { CharacterResponseService } from '../../src/character/services/character-response.service';
import { LLMService } from '../../src/llm/services/llm.service';
import { PromptTemplateService } from '../../src/prompt-template/prompt-template.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { LogService } from '../../src/logging/log.service';
import { Character } from '../../src/character/entities/character.entity';
import { EmotionalState } from '../../src/character/entities/emotional-state';
import { LLMMessageRole } from '../../src/llm/services/llm.service';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';

createTestSuite('CharacterResponseService Unit Tests', () => {
  const mockLlmService = { generateText: jest.fn() };
  const mockPromptTemplateService = { createCharacterSystemPrompt: jest.fn() };
  const mockNeedsService = { getActiveNeeds: jest.fn() };
  const mockLogService = { setContext: jest.fn(), debug: jest.fn(), error: jest.fn() };

  const providers = [
    CharacterResponseService,
    { provide: LLMService, useValue: mockLlmService },
    { provide: PromptTemplateService, useValue: mockPromptTemplateService },
    { provide: NeedsService, useValue: mockNeedsService },
    { provide: LogService, useValue: mockLogService },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
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

      const character = { id: 1 } as Character;
      const error = new Error('LLM failed');

      mockLlmService.generateText.mockRejectedValue(error);

      await expect(
        service.generateResponse(character, 'Hi', [], {} as EmotionalState, ''),
      ).rejects.toThrow(error);

      expect(mockLogService.error).toHaveBeenCalledWith(
        '[CharacterResponseService] Ошибка при генерации ответа',
        expect.anything(),
        error,
      );
    },
  );
});

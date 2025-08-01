import { Test, TestingModule } from '@nestjs/testing';
import {
  ContextCompressionService,
  CompressionType,
  DataImportanceLevel,
} from '../../../../src/character/services/analysis/context-compression.service';
import { LogService } from '../../../../src/logging/log.service';
import { LLMService } from '../../../../src/llm/services/llm.service';
import { DialogService } from '../../../../src/dialog/services/dialog.service';
import { PromptTemplateService } from '../../../../src/prompt-template/prompt-template.service';
import { Message } from '../../../../src/dialog/entities/message.entity';

describe('ContextCompressionService', () => {
  let service: ContextCompressionService;
  let mockLLMService: jest.Mocked<LLMService>;
  let mockDialogService: jest.Mocked<DialogService>;
  let mockPromptTemplateService: jest.Mocked<PromptTemplateService>;
  let mockLogService: jest.Mocked<LogService>;

  beforeEach(async () => {
    // Mock services
    mockLLMService = {
      generateText: jest.fn(),
    } as any;

    mockDialogService = {
      getDialogHistory: jest.fn(),
    } as any;

    mockPromptTemplateService = {
      createPrompt: jest.fn(),
    } as any;

    mockLogService = {
      setContext: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextCompressionService,
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: DialogService,
          useValue: mockDialogService,
        },
        {
          provide: PromptTemplateService,
          useValue: mockPromptTemplateService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    }).compile();

    service = module.get<ContextCompressionService>(ContextCompressionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeAndCompressContext', () => {
    it('should compress context with default adaptive algorithm', async () => {
      const contextData = 'Test context data\n\nSecond paragraph\n\nThird paragraph';
      const characterId = 1;

      // Mock LLM response for concept extraction
      mockLLMService.generateText.mockResolvedValue({
        text: 'test, context, data',
        requestInfo: {
          requestId: 'test',
          fromCache: false,
          executionTime: 100,
          model: 'test-model',
          promptTokens: 5,
          completionTokens: 5,
          totalTokens: 10,
        },
      });

      const result = await service.analyzeAndCompressContext(
        contextData,
        characterId,
        CompressionType.ADAPTIVE,
      );

      expect(result).toBeDefined();
      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.compressedSize).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.reconstructionPossibility).toBeGreaterThanOrEqual(0);
    });

    it('should handle semantic compression type', async () => {
      const contextData = 'Test semantic content\n\nRelated semantic content';
      const characterId = 1;

      mockLLMService.generateText.mockResolvedValue({
        text: 'semantic, content, test',
        requestInfo: {
          requestId: 'test',
          fromCache: false,
          executionTime: 100,
          model: 'test-model',
          promptTokens: 5,
          completionTokens: 5,
          totalTokens: 10,
        },
      });

      const result = await service.analyzeAndCompressContext(
        contextData,
        characterId,
        CompressionType.SEMANTIC,
      );

      expect(result).toBeDefined();
      expect(result.compressedData.semanticNodes).toBeDefined();
      expect(result.preservedSemanticNodes).toBeDefined();
    });

    it('should handle emotional weighted compression', async () => {
      const contextData = 'Я очень счастлив сегодня\n\nРадость переполняет меня';
      const characterId = 1;

      mockLLMService.generateText.mockResolvedValue({
        text: 'счастье, радость, эмоции',
        requestInfo: {
          requestId: 'test',
          fromCache: false,
          executionTime: 100,
          model: 'test-model',
          promptTokens: 5,
          completionTokens: 5,
          totalTokens: 10,
        },
      });

      const result = await service.analyzeAndCompressContext(
        contextData,
        characterId,
        CompressionType.EMOTIONAL_WEIGHTED,
      );

      expect(result).toBeDefined();
      expect(result.compressedData.emotionalMarkers.length).toBeGreaterThan(0);
    });

    it('should handle LLM service failures gracefully', async () => {
      const contextData = 'Test context for fallback';
      const characterId = 1;

      // Mock LLM failure
      mockLLMService.generateText.mockRejectedValue(new Error('LLM service unavailable'));

      const result = await service.analyzeAndCompressContext(
        contextData,
        characterId,
        CompressionType.SEMANTIC,
      );

      expect(result).toBeDefined();
      expect(result.compressionRatio).toBeGreaterThan(0);
      // Should still work with fallback algorithms
    });
  });

  describe('generateAdaptiveContext', () => {
    it('should generate adaptive context for character', async () => {
      const characterId = 1;
      const userId = 123;
      const currentDialog = 'Current conversation context';

      // Mock dialog history
      mockDialogService.getDialogHistory.mockResolvedValue([
        {
          id: 1,
          content: 'Previous message',
          createdAt: new Date(),
          userId: 123,
          characterId: 1,
        } as Message,
      ]);

      const result = await service.generateAdaptiveContext(characterId, userId, currentDialog);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain(characterId.toString());
    });

    it('should handle empty dialog history', async () => {
      const characterId = 1;
      const userId = 123;
      const currentDialog = 'Current conversation context';

      mockDialogService.getDialogHistory.mockResolvedValue([]);

      const result = await service.generateAdaptiveContext(characterId, userId, currentDialog);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('convertMessagesToSegments', () => {
    it('should convert messages to context segments', async () => {
      const messages: Message[] = [
        {
          id: 1,
          content: 'First message',
          createdAt: new Date(),
          userId: 123,
          characterId: 1,
        } as Message,
        {
          id: 2,
          content: 'Second message',
          createdAt: new Date(),
          userId: 123,
          characterId: 1,
        } as Message,
      ];

      const segments = await service.convertMessagesToSegments(messages);

      expect(segments).toHaveLength(2);
      expect(segments[0]).toMatchObject({
        content: 'First message',
        importance: DataImportanceLevel.BACKGROUND,
        relevanceScore: 0.5,
        emotionalMarkers: [],
        semanticNodes: [],
        compressionLevel: 0,
        childSegmentIds: [],
        semanticFingerprint: '',
      });
    });

    it('should handle empty message array', async () => {
      const segments = await service.convertMessagesToSegments([]);

      expect(segments).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle errors in context analysis gracefully', async () => {
      const contextData = 'Test context';
      const characterId = 1;

      // Force an error in the processing chain
      mockLLMService.generateText.mockRejectedValue(new Error('Unexpected error'));

      // Should not throw, should handle gracefully
      await expect(
        service.analyzeAndCompressContext(contextData, characterId),
      ).resolves.toBeDefined();
    });
  });

  describe('performance characteristics', () => {
    it('should complete compression within reasonable time', async () => {
      const contextData = Array(100).fill('Test context segment').join('\n\n');
      const characterId = 1;

      mockLLMService.generateText.mockResolvedValue({
        text: 'test, context, performance',
        requestInfo: {
          requestId: 'test',
          fromCache: false,
          executionTime: 100,
          model: 'test-model',
          promptTokens: 5,
          completionTokens: 5,
          totalTokens: 10,
        },
      });

      const startTime = Date.now();
      const result = await service.analyzeAndCompressContext(contextData, characterId);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});

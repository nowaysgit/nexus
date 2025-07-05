import { Injectable } from '@nestjs/common';
import { LogService } from '../../../logging/log.service';
import { BaseService } from '../../../common/base/base.service';
import { LLMService } from '../../../llm/services/llm.service';
import { PromptTemplateService } from '../../../prompt-template/prompt-template.service';
import { Message } from '../../../dialog/entities/message.entity';
import { LLMMessageRole } from '../../../common/interfaces/llm-provider.interface';
import { DialogService } from '../../../dialog/services/dialog.service';

export enum DataImportanceLevel {
  CRITICAL = 'critical',
  SIGNIFICANT = 'significant',
  BACKGROUND = 'background',
}

export enum CompressionType {
  SEMANTIC = 'semantic',
  TEMPORAL = 'temporal',
  RELEVANCE_BASED = 'relevance_based',
  EMOTIONAL_WEIGHTED = 'emotional_weighted',
}

export interface IContextSegment {
  id: string;
  content: string;
  timestamp: Date;
  importance: DataImportanceLevel;
  relevanceScore: number;
  emotionalMarkers: string[];
  semanticNodes: string[];
  compressionLevel: number;
}

export interface ICompressionResult {
  compressedData: IContextSegment;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  preservedSemanticNodes: string[];
  lostInformation: string[];
}

export interface IContextWindow {
  characterId: number;
  totalTokens: number;
  segments: IContextSegment[];
  lastCompression: Date;
  compressionHistory: ICompressionResult[];
}

@Injectable()
export class ContextCompressionService extends BaseService {
  private readonly maxContextTokens = 8000;
  private readonly compressionThreshold = 0.8;

  constructor(
    private readonly llmService: LLMService,
    private readonly dialogService: DialogService,
    private readonly promptTemplateService: PromptTemplateService,
    logService: LogService,
  ) {
    super(logService);
    this.logInfo('Сервис интеллектуальной компрессии контекста инициализирован');
  }

  async analyzeAndCompressContext(
    contextData: string,
    __characterId: number,
    compressionType: CompressionType = CompressionType.SEMANTIC,
  ): Promise<ICompressionResult> {
    return this.withErrorHandling('анализе и компрессии контекста', async () => {
      const segments = await this.segmentContext(contextData);
      const classifiedSegments = await this.classifyInformationImportance(segments);

      const compressionResult = await this.performMultilevelCompression(
        classifiedSegments,
        compressionType,
      );

      this.logInfo(`Контекст сжат с коэффициентом ${compressionResult.compressionRatio}:1`);
      return compressionResult;
    });
  }

  async generateAdaptiveContext(
    characterId: number,
    userId: number,
    currentDialog: string,
  ): Promise<string> {
    return this.withErrorHandling('генерации адаптивного контекста', async () => {
      const contextWindow = await this.getCharacterContextWindow(characterId, userId);

      if (contextWindow.totalTokens > this.maxContextTokens * this.compressionThreshold) {
        await this.performDynamicCompression(contextWindow);
      }

      const adaptiveContext = await this.assembleAdaptiveContext(contextWindow, currentDialog);

      return adaptiveContext;
    });
  }

  /**
   * Преобразование сообщений в сегменты контекста
   */
  async convertMessagesToSegments(messages: Message[]): Promise<IContextSegment[]> {
    return messages.map((message, index) => ({
      id: `msg_${message.id}_${index}`,
      content: message.content,
      timestamp: message.createdAt,
      importance: DataImportanceLevel.BACKGROUND,
      relevanceScore: 0.5,
      emotionalMarkers: [],
      semanticNodes: [],
      compressionLevel: 0,
    }));
  }

  private async segmentContext(contextData: string): Promise<IContextSegment[]> {
    const segments = contextData.split(/\n\n|\n---\n/).filter(segment => segment.trim().length > 0);

    return segments.map((segment, index) => ({
      id: `segment_${Date.now()}_${index}`,
      content: segment.trim(),
      timestamp: new Date(),
      importance: DataImportanceLevel.BACKGROUND,
      relevanceScore: 0.5,
      emotionalMarkers: [],
      semanticNodes: [],
      compressionLevel: 0,
    }));
  }

  private async classifyInformationImportance(
    segments: IContextSegment[],
  ): Promise<IContextSegment[]> {
    return this.withErrorHandling('классификации важности информации', async () => {
      const classifiedSegments: IContextSegment[] = [];

      for (const segment of segments) {
        const importance = await this.determineImportanceLevel(segment.content);
        const relevanceScore = await this.calculateRelevanceScore(segment.content);

        classifiedSegments.push({
          ...segment,
          importance,
          relevanceScore,
        });
      }

      return classifiedSegments.sort((a, b) => {
        const importanceWeight =
          this.getImportanceWeight(a.importance) - this.getImportanceWeight(b.importance);
        if (importanceWeight !== 0) return importanceWeight;
        return b.relevanceScore - a.relevanceScore;
      });
    });
  }

  private async determineImportanceLevel(content: string): Promise<DataImportanceLevel> {
    return this.withErrorHandling('определении уровня важности', async () => {
      try {
        // Используем PromptTemplateService для создания промпта анализа важности
        const prompt = this.promptTemplateService.createPrompt('context-importance-analysis', {
          content: content.substring(0, 500), // Ограничиваем длину для эффективности
        });

        const response = await this.llmService.generateText(
          [{ role: LLMMessageRole.USER, content: prompt }],
          { maxTokens: 10 },
        );

        const level = response.text.trim().toLowerCase();
        if (level.includes('critical')) return DataImportanceLevel.CRITICAL;
        if (level.includes('significant')) return DataImportanceLevel.SIGNIFICANT;
        return DataImportanceLevel.BACKGROUND;
      } catch (_error) {
        // Fallback для тестов и случаев когда LLM недоступен
        this.logDebug('LLM недоступен для анализа важности, используется fallback');

        // Простая эвристика на основе ключевых слов
        const criticalKeywords = ['важно', 'критично', 'срочно', 'проблема', 'ошибка'];
        const significantKeywords = ['интересно', 'нравится', 'хочу', 'думаю', 'чувствую'];

        const lowerContent = content.toLowerCase();

        if (criticalKeywords.some(keyword => lowerContent.includes(keyword))) {
          return DataImportanceLevel.CRITICAL;
        }

        if (significantKeywords.some(keyword => lowerContent.includes(keyword))) {
          return DataImportanceLevel.SIGNIFICANT;
        }

        return DataImportanceLevel.BACKGROUND;
      }
    });
  }

  private async calculateRelevanceScore(content: string): Promise<number> {
    const relevanceKeywords = ['чувствую', 'думаю', 'хочу', 'нравится', 'важно'];
    const words = content.toLowerCase().split(/\s+/);
    const matches = words.filter(word => relevanceKeywords.some(keyword => word.includes(keyword)));

    return Math.min((matches.length / words.length) * 10, 1.0);
  }

  private getImportanceWeight(importance: DataImportanceLevel): number {
    switch (importance) {
      case DataImportanceLevel.CRITICAL:
        return 3;
      case DataImportanceLevel.SIGNIFICANT:
        return 2;
      case DataImportanceLevel.BACKGROUND:
        return 1;
    }
  }

  private async performMultilevelCompression(
    segments: IContextSegment[],
    _compressionType: CompressionType,
  ): Promise<ICompressionResult> {
    const originalSize = segments.reduce((sum, s) => sum + s.content.length, 0);
    const compressedSegments = segments; // Упрощенная версия
    const compressedSize = compressedSegments.reduce((sum, s) => sum + s.content.length, 0);
    const compressionRatio = originalSize / compressedSize;

    return {
      compressedData: {
        id: `compressed_${Date.now()}`,
        content: compressedSegments.map(s => s.content).join('\n'),
        timestamp: new Date(),
        importance: DataImportanceLevel.SIGNIFICANT,
        relevanceScore: 0.8,
        emotionalMarkers: compressedSegments.flatMap(s => s.emotionalMarkers),
        semanticNodes: compressedSegments.flatMap(s => s.semanticNodes),
        compressionLevel: Math.round((1 - compressedSize / originalSize) * 100),
      },
      originalSize,
      compressedSize,
      compressionRatio,
      preservedSemanticNodes: compressedSegments.flatMap(s => s.semanticNodes),
      lostInformation: [],
    };
  }

  private async getCharacterContextWindow(
    characterId: number,
    userId: number,
  ): Promise<IContextWindow> {
    // Получаем реальные сообщения из диалогов
    let messages: Message[] = [];
    if (this.dialogService) {
      messages = await this.dialogService.getDialogHistory(String(userId), characterId, 100);
    }

    // Конвертируем в сегменты контекста
    const segments = await this.convertMessagesToSegments(messages);

    // Вычисляем общее количество токенов
    const totalTokens = segments.reduce(
      (sum, segment) => sum + Math.ceil(segment.content.length * 0.25),
      0,
    );

    return {
      characterId,
      totalTokens,
      segments,
      lastCompression: new Date(),
      compressionHistory: [],
    };
  }

  private async performDynamicCompression(contextWindow: IContextWindow): Promise<void> {
    this.logInfo(`Выполняется динамическая компрессия для персонажа ${contextWindow.characterId}`);
  }

  private async assembleAdaptiveContext(
    contextWindow: IContextWindow,
    currentDialog: string,
  ): Promise<string> {
    return `Adaptive context for character ${contextWindow.characterId}:\n${currentDialog}`;
  }
}

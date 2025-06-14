import { Injectable } from '@nestjs/common';
import { LLMService } from '../../llm/services/llm.service';
import { LLMMessageRole } from '../../common/interfaces/llm-provider.interface';
import { DialogService } from '../../dialog/services/dialog.service';
import { Message } from '../../dialog/entities/message.entity';
import { LogService } from '../../logging/log.service';
import { PromptTemplateService } from '../../prompt-template/prompt-template.service';
import { withErrorHandling } from '../../common/utils/error-handling/error-handling.utils';

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
export class ContextCompressionService {
  private readonly maxContextTokens = 8000;
  private readonly compressionThreshold = 0.8;

  constructor(
    private readonly llmService: LLMService,
    private readonly dialogService: DialogService,
    private readonly promptTemplateService: PromptTemplateService,
    private readonly logService: LogService,
  ) {
    this.logService.log('Сервис интеллектуальной компрессии контекста инициализирован');
  }

  async analyzeAndCompressContext(
    contextData: string,
    characterId: number,
    compressionType: CompressionType = CompressionType.SEMANTIC,
  ): Promise<ICompressionResult> {
    return withErrorHandling(
      async () => {
        const segments = await this.segmentContext(contextData);
        const classifiedSegments = await this.classifyInformationImportance(segments);

        const compressionResult = await this.performMultilevelCompression(
          classifiedSegments,
          compressionType,
        );

        this.logService.log(
          `Контекст сжат с коэффициентом ${compressionResult.compressionRatio}:1`,
        );
        return compressionResult;
      },
      'анализе и компрессии контекста',
      this.logService,
      { characterId, compressionType },
      null as never,
    );
  }

  async generateAdaptiveContext(
    characterId: number,
    userId: number,
    currentDialog: string,
  ): Promise<string> {
    return withErrorHandling(
      async () => {
        const contextWindow = await this.getCharacterContextWindow(characterId, userId);

        if (contextWindow.totalTokens > this.maxContextTokens * this.compressionThreshold) {
          await this.performDynamicCompression(contextWindow);
        }

        const adaptiveContext = await this.assembleAdaptiveContext(contextWindow, currentDialog);

        return adaptiveContext;
      },
      'генерации адаптивного контекста',
      this.logService,
      { characterId, userId },
      '',
    );
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
    return withErrorHandling(
      async () => {
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
      },
      'классификации важности информации',
      this.logService,
      { segmentsCount: segments.length },
      [],
    );
  }

  private async determineImportanceLevel(content: string): Promise<DataImportanceLevel> {
    return withErrorHandling(
      async () => {
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
      },
      'определении уровня важности',
      this.logService,
      { contentLength: content.length },
      DataImportanceLevel.BACKGROUND,
    );
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
    const messages = await this.dialogService.getDialogHistory(String(userId), characterId, 100);

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
    this.logService.log(
      `Выполняется динамическая компрессия для персонажа ${contextWindow.characterId}`,
    );
  }

  private async assembleAdaptiveContext(
    contextWindow: IContextWindow,
    currentDialog: string,
  ): Promise<string> {
    return `Adaptive context for character ${contextWindow.characterId}:\n${currentDialog}`;
  }
}

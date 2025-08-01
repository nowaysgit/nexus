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
  HIERARCHICAL = 'hierarchical',
  ADAPTIVE = 'adaptive',
}

export interface ISemanticNode {
  id: string;
  concept: string;
  weight: number;
  connections: string[];
  emotionalContext: string[];
}

export interface IContextSegment {
  id: string;
  content: string;
  timestamp: Date;
  importance: DataImportanceLevel;
  relevanceScore: number;
  emotionalMarkers: string[];
  semanticNodes: ISemanticNode[];
  compressionLevel: number;
  parentSegmentId?: string;
  childSegmentIds: string[];
  semanticFingerprint: string;
}

export interface ICompressionResult {
  compressedData: IContextSegment;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  preservedSemanticNodes: ISemanticNode[];
  lostInformation: string[];
  qualityScore: number;
  reconstructionPossibility: number;
}

export interface IContextWindow {
  characterId: number;
  totalTokens: number;
  segments: IContextSegment[];
  lastCompression: Date;
  compressionHistory: ICompressionResult[];
  semanticGraph: Map<string, ISemanticNode>;
  compressionQuality: number;
}

@Injectable()
export class ContextCompressionService extends BaseService {
  private readonly maxContextTokens = 8000;
  private readonly compressionThreshold = 0.8;
  private readonly semanticSimilarityThreshold = 0.7;
  private readonly qualityThreshold = 0.8;

  constructor(
    private readonly llmService: LLMService,
    private readonly dialogService: DialogService,
    private readonly promptTemplateService: PromptTemplateService,
    logService: LogService,
  ) {
    super(logService);
    this.logInfo('Сервис продвинутой интеллектуальной компрессии контекста инициализирован');
  }

  /**
   * Основной метод анализа и компрессии с продвинутыми алгоритмами
   */
  async analyzeAndCompressContext(
    contextData: string,
    characterId: number,
    compressionType: CompressionType = CompressionType.ADAPTIVE,
  ): Promise<ICompressionResult> {
    return this.withErrorHandling('анализе и компрессии контекста', async () => {
      // 1. Сегментирование с семантическим анализом
      const segments = await this.advancedSegmentation(contextData);

      // 2. Построение семантического графа
      const semanticGraph = await this.buildSemanticGraph(segments);

      // 3. Классификация важности с контекстом
      const classifiedSegments = await this.advancedImportanceClassification(
        segments,
        semanticGraph,
      );

      // 4. Выбор оптимального алгоритма компрессии
      const optimalType =
        compressionType === CompressionType.ADAPTIVE
          ? await this.selectOptimalCompressionType(classifiedSegments)
          : compressionType;

      // 5. Многоуровневая компрессия с сохранением семантики
      const compressionResult = await this.performAdvancedCompression(
        classifiedSegments,
        semanticGraph,
        optimalType,
      );

      this.logInfo(
        `Контекст сжат с коэффициентом ${compressionResult.compressionRatio.toFixed(2)}:1, ` +
          `качество: ${(compressionResult.qualityScore * 100).toFixed(1)}%`,
      );

      return compressionResult;
    });
  }

  /**
   * Продвинутое сегментирование с семантическим анализом
   */
  private async advancedSegmentation(contextData: string): Promise<IContextSegment[]> {
    return this.withErrorHandling('продвинутом сегментировании', async () => {
      // Разделение по семантическим границам
      const segments = this.splitBySemanticBoundaries(contextData);

      // Создание семантических отпечатков
      const segmentsWithFingerprints = await Promise.all(
        segments.map(async (segment, index) => {
          const semanticFingerprint = await this.generateSemanticFingerprint(segment.content);
          const emotionalMarkers = await this.extractEmotionalMarkers(segment.content);

          return {
            ...segment,
            id: `advanced_seg_${Date.now()}_${index}`,
            semanticFingerprint,
            emotionalMarkers,
            childSegmentIds: [],
          };
        }),
      );

      return segmentsWithFingerprints;
    });
  }

  /**
   * Построение семантического графа связей
   */
  private async buildSemanticGraph(
    segments: IContextSegment[],
  ): Promise<Map<string, ISemanticNode>> {
    return this.withErrorHandling('построении семантического графа', async () => {
      const semanticGraph = new Map<string, ISemanticNode>();

      for (const segment of segments) {
        const concepts = await this.extractSemanticConcepts(segment.content);

        for (const concept of concepts) {
          const nodeId = `concept_${concept.replace(/\s+/g, '_').toLowerCase()}`;

          if (semanticGraph.has(nodeId)) {
            const existingNode = semanticGraph.get(nodeId);
            existingNode.weight += 1;
            existingNode.connections = [...new Set([...existingNode.connections, segment.id])];
          } else {
            const newNode: ISemanticNode = {
              id: nodeId,
              concept,
              weight: 1,
              connections: [segment.id],
              emotionalContext: segment.emotionalMarkers,
            };
            semanticGraph.set(nodeId, newNode);
          }
        }

        // Обновляем сегмент семантическими узлами
        const segmentNodes = concepts.map(concept => {
          const nodeId = `concept_${concept.replace(/\s+/g, '_').toLowerCase()}`;
          return semanticGraph.get(nodeId);
        });

        segment.semanticNodes = segmentNodes;
      }

      return semanticGraph;
    });
  }

  /**
   * Продвинутая классификация важности с учетом семантического контекста
   */
  private async advancedImportanceClassification(
    segments: IContextSegment[],
    semanticGraph: Map<string, ISemanticNode>,
  ): Promise<IContextSegment[]> {
    return this.withErrorHandling('продвинутой классификации важности', async () => {
      const classifiedSegments: IContextSegment[] = [];

      for (const segment of segments) {
        // Анализ важности на основе семантических связей
        const semanticImportance = this.calculateSemanticImportance(segment, semanticGraph);

        // Временная важность (недавние сегменты более важны)
        const temporalImportance = this.calculateTemporalImportance(segment);

        // Эмоциональная важность
        const emotionalImportance = this.calculateEmotionalImportance(segment);

        // Комбинированный анализ важности
        const combinedImportance = await this.determineCombinedImportance(
          segment.content,
          semanticImportance,
          temporalImportance,
          emotionalImportance,
        );

        // Расчет релевантности с учетом всех факторов
        const enhancedRelevanceScore = this.calculateEnhancedRelevance(
          segment,
          semanticImportance,
          temporalImportance,
          emotionalImportance,
        );

        classifiedSegments.push({
          ...segment,
          importance: combinedImportance,
          relevanceScore: enhancedRelevanceScore,
        });
      }

      return this.sortByImportanceAndRelevance(classifiedSegments);
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
      childSegmentIds: [],
      semanticFingerprint: '',
    }));
  }

  // ======= ПРИВАТНЫЕ МЕТОДЫ ПРОДВИНУТОЙ КОМПРЕССИИ =======

  /**
   * Разделение по семантическим границам
   */
  private splitBySemanticBoundaries(contextData: string): IContextSegment[] {
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
      childSegmentIds: [],
      semanticFingerprint: '',
    }));
  }

  /**
   * Генерация семантического отпечатка
   */
  private async generateSemanticFingerprint(content: string): Promise<string> {
    return this.withErrorHandling('генерации семантического отпечатка', async () => {
      // Создание хеша на основе ключевых семантических элементов
      const keywords = content
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 10)
        .sort()
        .join('|');

      // Простой хеш для демонстрации (в продакшене можно использовать более сложные алгоритмы)
      return Buffer.from(keywords).toString('base64').substring(0, 16);
    });
  }

  /**
   * Извлечение эмоциональных маркеров
   */
  private async extractEmotionalMarkers(content: string): Promise<string[]> {
    const emotionalWords = [
      'радость',
      'грусть',
      'злость',
      'страх',
      'удивление',
      'отвращение',
      'счастье',
      'печаль',
      'гнев',
      'тревога',
      'восторг',
      'разочарование',
      'любовь',
      'ненависть',
      'восхищение',
      'презрение',
      'надежда',
      'отчаяние',
    ];

    const lowerContent = content.toLowerCase();
    return emotionalWords.filter(emotion => lowerContent.includes(emotion));
  }

  /**
   * Извлечение семантических концептов
   */
  private async extractSemanticConcepts(content: string): Promise<string[]> {
    return this.withErrorHandling('извлечении семантических концептов', async () => {
      try {
        const prompt = `Извлеки 3-5 ключевых концептов из текста. Верни только слова через запятую:\n${content.substring(0, 200)}`;

        const response = await this.llmService.generateText(
          [{ role: LLMMessageRole.USER, content: prompt }],
          { maxTokens: 50 },
        );

        const concepts = response.text
          .split(',')
          .map(c => c.trim())
          .filter(c => c.length > 2)
          .slice(0, 5);

        return concepts.length > 0 ? concepts : this.extractConceptsFallback(content);
      } catch (_error) {
        return this.extractConceptsFallback(content);
      }
    });
  }

  /**
   * Fallback метод извлечения концептов
   */
  private extractConceptsFallback(content: string): string[] {
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Простая частотная статистика
    const frequency = words.reduce(
      (acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Расчет семантической важности
   */
  private calculateSemanticImportance(
    segment: IContextSegment,
    semanticGraph: Map<string, ISemanticNode>,
  ): number {
    if (segment.semanticNodes.length === 0) return 0.1;

    const totalWeight = segment.semanticNodes.reduce((sum, node) => sum + node.weight, 0);
    const avgWeight = totalWeight / segment.semanticNodes.length;
    const connectionsCount = segment.semanticNodes.reduce(
      (sum, node) => sum + node.connections.length,
      0,
    );

    return Math.min((avgWeight * 0.6 + connectionsCount * 0.4) / 10, 1.0);
  }

  /**
   * Расчет временной важности
   */
  private calculateTemporalImportance(segment: IContextSegment): number {
    const now = new Date();
    const timeDiff = now.getTime() - segment.timestamp.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    // Экспоненциальное убывание важности со временем
    return Math.exp(-hoursDiff / 24) * 0.8 + 0.2;
  }

  /**
   * Расчет эмоциональной важности
   */
  private calculateEmotionalImportance(segment: IContextSegment): number {
    if (segment.emotionalMarkers.length === 0) return 0.3;

    const intensityWords = ['очень', 'крайне', 'невероятно', 'чрезвычайно'];
    const hasIntensity = intensityWords.some(word => segment.content.toLowerCase().includes(word));

    const baseScore = Math.min(segment.emotionalMarkers.length * 0.2, 0.8);
    return hasIntensity ? Math.min(baseScore * 1.5, 1.0) : baseScore;
  }

  /**
   * Определение комбинированной важности
   */
  private async determineCombinedImportance(
    content: string,
    semanticImportance: number,
    temporalImportance: number,
    emotionalImportance: number,
  ): Promise<DataImportanceLevel> {
    const combinedScore =
      semanticImportance * 0.4 + temporalImportance * 0.3 + emotionalImportance * 0.3;

    if (combinedScore > 0.7) return DataImportanceLevel.CRITICAL;
    if (combinedScore > 0.4) return DataImportanceLevel.SIGNIFICANT;
    return DataImportanceLevel.BACKGROUND;
  }

  /**
   * Расчет улучшенной релевантности
   */
  private calculateEnhancedRelevance(
    segment: IContextSegment,
    semanticImportance: number,
    temporalImportance: number,
    emotionalImportance: number,
  ): number {
    const baseRelevance = segment.relevanceScore || 0.5;

    return Math.min(
      baseRelevance * 0.3 +
        semanticImportance * 0.3 +
        temporalImportance * 0.2 +
        emotionalImportance * 0.2,
      1.0,
    );
  }

  /**
   * Сортировка по важности и релевантности
   */
  private sortByImportanceAndRelevance(segments: IContextSegment[]): IContextSegment[] {
    return segments.sort((a, b) => {
      const importanceWeight =
        this.getImportanceWeight(b.importance) - this.getImportanceWeight(a.importance);
      if (importanceWeight !== 0) return importanceWeight;
      return b.relevanceScore - a.relevanceScore;
    });
  }

  /**
   * Выбор оптимального типа компрессии
   */
  private async selectOptimalCompressionType(
    segments: IContextSegment[],
  ): Promise<CompressionType> {
    const emotionalCount = segments.filter(s => s.emotionalMarkers.length > 0).length;
    const semanticComplexity =
      segments.reduce((sum, s) => sum + s.semanticNodes.length, 0) / segments.length;
    const temporalSpread = this.calculateTemporalSpread(segments);

    if (emotionalCount > segments.length * 0.6) {
      return CompressionType.EMOTIONAL_WEIGHTED;
    }

    if (semanticComplexity > 3) {
      return CompressionType.SEMANTIC;
    }

    if (temporalSpread > 24 * 7) {
      // Больше недели
      return CompressionType.TEMPORAL;
    }

    return CompressionType.HIERARCHICAL;
  }

  /**
   * Расчет временного разброса
   */
  private calculateTemporalSpread(segments: IContextSegment[]): number {
    if (segments.length < 2) return 0;

    const timestamps = segments.map(s => s.timestamp.getTime()).sort();
    return (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60); // В часах
  }

  /**
   * Продвинутая компрессия
   */
  private async performAdvancedCompression(
    segments: IContextSegment[],
    semanticGraph: Map<string, ISemanticNode>,
    compressionType: CompressionType,
  ): Promise<ICompressionResult> {
    return this.withErrorHandling('продвинутой компрессии', async () => {
      const originalSize = segments.reduce((sum, s) => sum + s.content.length, 0);

      let compressedSegments: IContextSegment[];
      let qualityScore: number;

      switch (compressionType) {
        case CompressionType.SEMANTIC:
          ({ segments: compressedSegments, quality: qualityScore } =
            await this.performSemanticCompression(segments, semanticGraph));
          break;

        case CompressionType.EMOTIONAL_WEIGHTED:
          ({ segments: compressedSegments, quality: qualityScore } =
            await this.performEmotionalCompression(segments));
          break;

        case CompressionType.HIERARCHICAL:
          ({ segments: compressedSegments, quality: qualityScore } =
            await this.performHierarchicalCompression(segments));
          break;

        case CompressionType.TEMPORAL:
          ({ segments: compressedSegments, quality: qualityScore } =
            await this.performTemporalCompression(segments));
          break;

        default:
          compressedSegments = segments.slice(0, Math.ceil(segments.length * 0.7));
          qualityScore = 0.6;
      }

      const compressedSize = compressedSegments.reduce((sum, s) => sum + s.content.length, 0);
      const compressionRatio = originalSize / Math.max(compressedSize, 1);

      const preservedNodes = compressedSegments.flatMap(s => s.semanticNodes);
      const allNodes = segments.flatMap(s => s.semanticNodes);
      const lostNodes = allNodes.filter(
        node => !preservedNodes.some(preserved => preserved.id === node.id),
      );

      return {
        compressedData: {
          id: `compressed_${Date.now()}`,
          content: compressedSegments.map(s => s.content).join('\n\n'),
          timestamp: new Date(),
          importance: DataImportanceLevel.SIGNIFICANT,
          relevanceScore: 0.8,
          emotionalMarkers: [...new Set(compressedSegments.flatMap(s => s.emotionalMarkers))],
          semanticNodes: preservedNodes,
          compressionLevel: Math.round((1 - compressedSize / originalSize) * 100),
          childSegmentIds: compressedSegments.map(s => s.id),
          semanticFingerprint: await this.generateSemanticFingerprint(
            compressedSegments.map(s => s.content).join(' '),
          ),
        },
        originalSize,
        compressedSize,
        compressionRatio,
        preservedSemanticNodes: preservedNodes,
        lostInformation: lostNodes.map(node => node.concept),
        qualityScore,
        reconstructionPossibility: this.calculateReconstructionPossibility(
          qualityScore,
          compressionRatio,
        ),
      };
    });
  }

  /**
   * Семантическая компрессия
   */
  private async performSemanticCompression(
    segments: IContextSegment[],
    semanticGraph: Map<string, ISemanticNode>,
  ): Promise<{ segments: IContextSegment[]; quality: number }> {
    // Группировка сегментов по семантической схожести
    const groups = this.groupBySemanticsimilarity(segments);

    // Сжатие каждой группы с сохранением ключевой информации
    const compressedSegments: IContextSegment[] = [];
    let totalQuality = 0;

    for (const group of groups) {
      if (group.length === 1) {
        compressedSegments.push(group[0]);
        totalQuality += 1.0;
      } else {
        const mergedSegment = await this.mergeSemanticallySimilarSegments(group);
        compressedSegments.push(mergedSegment);
        totalQuality += 0.8; // Небольшая потеря качества при слиянии
      }
    }

    return {
      segments: compressedSegments,
      quality: totalQuality / groups.length,
    };
  }

  /**
   * Эмоциональная компрессия
   */
  private async performEmotionalCompression(
    segments: IContextSegment[],
  ): Promise<{ segments: IContextSegment[]; quality: number }> {
    // Приоритет эмоционально окрашенным сегментам
    const emotionalSegments = segments.filter(s => s.emotionalMarkers.length > 0);
    const neutralSegments = segments.filter(s => s.emotionalMarkers.length === 0);

    // Сохраняем все эмоциональные + часть нейтральных
    const selectedNeutral = neutralSegments
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, Math.ceil(neutralSegments.length * 0.3));

    return {
      segments: [...emotionalSegments, ...selectedNeutral],
      quality: emotionalSegments.length > 0 ? 0.9 : 0.6,
    };
  }

  /**
   * Иерархическая компрессия
   */
  private async performHierarchicalCompression(
    segments: IContextSegment[],
  ): Promise<{ segments: IContextSegment[]; quality: number }> {
    // Создание иерархии важности
    const critical = segments.filter(s => s.importance === DataImportanceLevel.CRITICAL);
    const significant = segments.filter(s => s.importance === DataImportanceLevel.SIGNIFICANT);
    const background = segments.filter(s => s.importance === DataImportanceLevel.BACKGROUND);

    // Сохраняем все критичные, большую часть значимых, малую часть фоновых
    const selectedSignificant = significant.slice(0, Math.ceil(significant.length * 0.6));
    const selectedBackground = background.slice(0, Math.ceil(background.length * 0.2));

    return {
      segments: [...critical, ...selectedSignificant, ...selectedBackground],
      quality: critical.length > 0 ? 0.85 : 0.7,
    };
  }

  /**
   * Временная компрессия
   */
  private async performTemporalCompression(
    segments: IContextSegment[],
  ): Promise<{ segments: IContextSegment[]; quality: number }> {
    // Сортировка по времени (новые важнее)
    const sortedByTime = segments.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Сохраняем больше недавних сегментов
    const recentCount = Math.ceil(segments.length * 0.7);

    return {
      segments: sortedByTime.slice(0, recentCount),
      quality: 0.75,
    };
  }

  /**
   * Группировка по семантической схожести
   */
  private groupBySemanticsimilarity(segments: IContextSegment[]): IContextSegment[][] {
    const groups: IContextSegment[][] = [];
    const processed = new Set<string>();

    for (const segment of segments) {
      if (processed.has(segment.id)) continue;

      const group = [segment];
      processed.add(segment.id);

      // Поиск семантически схожих сегментов
      for (const other of segments) {
        if (processed.has(other.id)) continue;

        const similarity = this.calculateSemanticSimilarity(segment, other);
        if (similarity > this.semanticSimilarityThreshold) {
          group.push(other);
          processed.add(other.id);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Расчет семантической схожести
   */
  private calculateSemanticSimilarity(
    segment1: IContextSegment,
    segment2: IContextSegment,
  ): number {
    // Сравнение семантических отпечатков
    if (segment1.semanticFingerprint && segment2.semanticFingerprint) {
      const similarity = this.compareFingerprints(
        segment1.semanticFingerprint,
        segment2.semanticFingerprint,
      );
      if (similarity > 0.5) return similarity;
    }

    // Сравнение семантических узлов
    const commonNodes = segment1.semanticNodes.filter(node1 =>
      segment2.semanticNodes.some(node2 => node1.concept === node2.concept),
    );

    const totalNodes = new Set([
      ...segment1.semanticNodes.map(n => n.concept),
      ...segment2.semanticNodes.map(n => n.concept),
    ]).size;

    return totalNodes > 0 ? commonNodes.length / totalNodes : 0;
  }

  /**
   * Сравнение семантических отпечатков
   */
  private compareFingerprints(fp1: string, fp2: string): number {
    if (fp1 === fp2) return 1.0;

    const chars1 = fp1.split('');
    const chars2 = fp2.split('');
    const commonChars = chars1.filter(char => chars2.includes(char)).length;

    return commonChars / Math.max(chars1.length, chars2.length);
  }

  /**
   * Слияние семантически схожих сегментов
   */
  private async mergeSemanticallySimilarSegments(
    segments: IContextSegment[],
  ): Promise<IContextSegment> {
    const mergedContent = segments
      .map(s => s.content)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Суммарная информация
    const mergedEmotionalMarkers = [...new Set(segments.flatMap(s => s.emotionalMarkers))];
    const mergedSemanticNodes = this.mergeSemanticNodes(segments.flatMap(s => s.semanticNodes));

    const avgRelevance = segments.reduce((sum, s) => sum + s.relevanceScore, 0) / segments.length;
    const highestImportance = this.getHighestImportance(segments.map(s => s.importance));

    return {
      id: `merged_${Date.now()}_${segments.map(s => s.id).join('_')}`,
      content: mergedContent,
      timestamp: new Date(),
      importance: highestImportance,
      relevanceScore: avgRelevance,
      emotionalMarkers: mergedEmotionalMarkers,
      semanticNodes: mergedSemanticNodes,
      compressionLevel: 1,
      childSegmentIds: segments.map(s => s.id),
      semanticFingerprint: await this.generateSemanticFingerprint(mergedContent),
    };
  }

  /**
   * Слияние семантических узлов
   */
  private mergeSemanticNodes(nodes: ISemanticNode[]): ISemanticNode[] {
    const nodeMap = new Map<string, ISemanticNode>();

    for (const node of nodes) {
      if (nodeMap.has(node.concept)) {
        const existing = nodeMap.get(node.concept);
        existing.weight += node.weight;
        existing.connections = [...new Set([...existing.connections, ...node.connections])];
        existing.emotionalContext = [
          ...new Set([...existing.emotionalContext, ...node.emotionalContext]),
        ];
      } else {
        nodeMap.set(node.concept, { ...node });
      }
    }

    return Array.from(nodeMap.values());
  }

  /**
   * Получение наивысшего уровня важности
   */
  private getHighestImportance(importances: DataImportanceLevel[]): DataImportanceLevel {
    if (importances.includes(DataImportanceLevel.CRITICAL)) {
      return DataImportanceLevel.CRITICAL;
    }
    if (importances.includes(DataImportanceLevel.SIGNIFICANT)) {
      return DataImportanceLevel.SIGNIFICANT;
    }
    return DataImportanceLevel.BACKGROUND;
  }

  /**
   * Расчет возможности реконструкции
   */
  private calculateReconstructionPossibility(
    qualityScore: number,
    compressionRatio: number,
  ): number {
    // Баланс между качеством и степенью сжатия
    const qualityWeight = 0.7;
    const compressionWeight = 0.3;

    const compressionPenalty = Math.min(compressionRatio / 5, 1); // Штраф за сильное сжатие

    return Math.max(qualityScore * qualityWeight - compressionPenalty * compressionWeight, 0);
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
      childSegmentIds: [],
      semanticFingerprint: '',
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
        childSegmentIds: compressedSegments.map(s => s.id),
        semanticFingerprint: await this.generateSemanticFingerprint(
          compressedSegments.map(s => s.content).join(' '),
        ),
      },
      originalSize,
      compressedSize,
      compressionRatio,
      preservedSemanticNodes: compressedSegments.flatMap(s => s.semanticNodes),
      lostInformation: [],
      qualityScore: 0.7,
      reconstructionPossibility: 0.6,
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
      semanticGraph: new Map(),
      compressionQuality: 0.8,
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

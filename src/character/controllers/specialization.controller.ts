import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SpecializationService } from '../services/core/specialization.service';
import {
  SpecializationProfile,
  SpecializationCombination,
  DynamicSpecialization,
  SpecializationRecommendation,
  KnowledgeDomain,
  CompetenceLevel,
  SpecializationType,
  LearningStyle,
  KnowledgeContext,
} from '../services/core/specialization.service';

/**
 * DTO для создания комбинации специализаций
 */
export class CreateSpecializationCombinationDto {
  primaryType: SpecializationType;
  secondaryType?: SpecializationType;
  dominantDomains: KnowledgeDomain[];
  supportingDomains: KnowledgeDomain[];
  learningStyle: LearningStyle;
  adaptabilityScore: number;
  curiosityLevel: number;
  socialPreference: 'introvert' | 'extrovert' | 'ambivert';
}

/**
 * DTO для обновления профиля специализации
 */
export class UpdateSpecializationProfileDto {
  competenceLevels?: Record<KnowledgeDomain, CompetenceLevel>;
  strongAreas?: KnowledgeDomain[];
  weakAreas?: KnowledgeDomain[];
  personalInterests?: string[];
  professionalBackground?: string[];
  educationalBackground?: string[];
  culturalBackground?: string[];
  specializationCombination?: SpecializationCombination;
}

/**
 * DTO для контекста взаимодействия
 */
export class InteractionContextDto {
  conversationTopic: string;
  userExpertiseLevel: CompetenceLevel;
  relationshipLevel: number;
  socialSetting: 'casual' | 'formal' | 'educational' | 'personal';
  emotionalState: string;
  previousInteractions: string[];
}

/**
 * Контроллер для управления специализациями персонажей
 */
@ApiTags('Character Specialization')
@Controller('characters/:characterId/specialization')
@UseGuards(JwtAuthGuard)
export class SpecializationController {
  constructor(private readonly specializationService: SpecializationService) {}

  /**
   * Получить профиль специализации персонажа
   */
  @Get('profile')
  @ApiOperation({ summary: 'Получить профиль специализации персонажа' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Профиль специализации успешно получен',
    type: Object,
  })
  async getSpecializationProfile(
    @Param('characterId', ParseIntPipe) characterId: number,
  ): Promise<SpecializationProfile> {
    return this.specializationService.getSpecializationProfile(characterId);
  }

  /**
   * Обновить профиль специализации персонажа
   */
  @Put('profile')
  @ApiOperation({ summary: 'Обновить профиль специализации персонажа' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа', type: 'number' })
  @ApiBody({ type: UpdateSpecializationProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Профиль специализации успешно обновлен',
    type: Object,
  })
  async updateSpecializationProfile(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body() updateDto: UpdateSpecializationProfileDto,
  ): Promise<SpecializationProfile> {
    return this.specializationService.updateSpecializationProfile(characterId, updateDto);
  }

  /**
   * Проверить компетенцию персонажа
   */
  @Post('competence-check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Проверить компетенцию персонажа для ответа на запрос' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа', type: 'number' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Запрос пользователя' },
        context: {
          type: 'object',
          description: 'Контекст взаимодействия',
          $ref: '#/components/schemas/InteractionContextDto',
        },
      },
      required: ['query', 'context'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Результат проверки компетенции',
    type: Object,
  })
  async checkCompetence(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body() body: { query: string; context: InteractionContextDto },
  ) {
    return this.specializationService.checkCompetence(characterId, body.query, body.context);
  }

  /**
   * Получить динамическую специализацию персонажа
   */
  @Get('dynamic')
  @ApiOperation({ summary: 'Получить динамическую специализацию персонажа' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Динамическая специализация успешно получена',
    type: Object,
  })
  async getDynamicSpecialization(
    @Param('characterId', ParseIntPipe) characterId: number,
  ): Promise<DynamicSpecialization | null> {
    const profile = await this.specializationService.getSpecializationProfile(characterId);
    return profile.dynamicSpecialization || null;
  }

  /**
   * Обновить динамическую специализацию на основе взаимодействия
   */
  @Post('dynamic/update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обновить динамическую специализацию на основе взаимодействия' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа', type: 'number' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          enum: Object.values(KnowledgeDomain),
          description: 'Область знаний',
        },
        context: {
          type: 'object',
          description: 'Контекст взаимодействия',
          $ref: '#/components/schemas/InteractionContextDto',
        },
      },
      required: ['domain', 'context'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Динамическая специализация успешно обновлена',
    type: Object,
  })
  async updateDynamicSpecialization(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body() body: { domain: KnowledgeDomain; context: InteractionContextDto },
  ): Promise<DynamicSpecialization> {
    return this.specializationService.updateDynamicSpecialization(
      characterId,
      body.domain,
      body.context,
    );
  }

  /**
   * Получить рекомендации по развитию специализации
   */
  @Get('recommendations')
  @ApiOperation({ summary: 'Получить рекомендации по развитию специализации' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа', type: 'number' })
  @ApiQuery({
    name: 'priority',
    required: false,
    enum: ['low', 'medium', 'high'],
    description: 'Фильтр по приоритету рекомендаций',
  })
  @ApiResponse({
    status: 200,
    description: 'Рекомендации успешно получены',
    type: [Object],
  })
  async getSpecializationRecommendations(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Query('priority') priority?: 'low' | 'medium' | 'high',
  ): Promise<SpecializationRecommendation[]> {
    const recommendations =
      await this.specializationService.getSpecializationRecommendations(characterId);

    if (priority) {
      return recommendations.filter(rec => rec.priority === priority);
    }

    return recommendations;
  }

  /**
   * Создать новую комбинацию специализаций
   */
  @Post('combination')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Создать новую комбинацию специализаций для персонажа' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа', type: 'number' })
  @ApiBody({ type: CreateSpecializationCombinationDto })
  @ApiResponse({
    status: 201,
    description: 'Комбинация специализаций успешно создана',
    type: Object,
  })
  async createSpecializationCombination(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body() combinationDto: CreateSpecializationCombinationDto,
  ): Promise<DynamicSpecialization> {
    // Создаем новую динамическую специализацию с указанной комбинацией
    const dynamicSpecialization = this.specializationService.createDynamicSpecialization(
      characterId,
      combinationDto,
    );

    // Обновляем профиль персонажа
    await this.specializationService.updateSpecializationProfile(characterId, {
      specializationCombination: combinationDto,
      dynamicSpecialization,
    });

    return dynamicSpecialization;
  }

  /**
   * Получить статистику использования специализаций
   */
  @Get('statistics')
  @ApiOperation({ summary: 'Получить статистику использования системы специализаций' })
  @ApiResponse({
    status: 200,
    description: 'Статистика успешно получена',
    type: Object,
  })
  async getUsageStatistics(): Promise<Record<string, unknown>> {
    return this.specializationService.getUsageStatistics();
  }

  /**
   * Получить все доступные домены знаний
   */
  @Get('domains')
  @ApiOperation({ summary: 'Получить список всех доступных доменов знаний' })
  @ApiResponse({
    status: 200,
    description: 'Список доменов знаний',
    schema: {
      type: 'array',
      items: {
        type: 'string',
        enum: Object.values(KnowledgeDomain),
      },
    },
  })
  async getKnowledgeDomains(): Promise<KnowledgeDomain[]> {
    return Object.values(KnowledgeDomain);
  }

  /**
   * Получить все доступные типы специализации
   */
  @Get('types')
  @ApiOperation({ summary: 'Получить список всех доступных типов специализации' })
  @ApiResponse({
    status: 200,
    description: 'Список типов специализации',
    schema: {
      type: 'array',
      items: {
        type: 'string',
        enum: Object.values(SpecializationType),
      },
    },
  })
  async getSpecializationTypes(): Promise<SpecializationType[]> {
    return Object.values(SpecializationType);
  }

  /**
   * Получить все доступные стили обучения
   */
  @Get('learning-styles')
  @ApiOperation({ summary: 'Получить список всех доступных стилей обучения' })
  @ApiResponse({
    status: 200,
    description: 'Список стилей обучения',
    schema: {
      type: 'array',
      items: {
        type: 'string',
        enum: Object.values(LearningStyle),
      },
    },
  })
  async getLearningStyles(): Promise<LearningStyle[]> {
    return Object.values(LearningStyle);
  }

  /**
   * Очистить кэш профилей специализации
   */
  @Post('cache/clear')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Очистить кэш профилей специализации' })
  @ApiResponse({
    status: 204,
    description: 'Кэш успешно очищен',
  })
  async clearCache(): Promise<void> {
    this.specializationService.clearCache();
  }

  /**
   * Получить эволюцию специализации персонажа
   */
  @Get('evolution')
  @ApiOperation({ summary: 'Получить историю эволюции специализации персонажа' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа', type: 'number' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Ограничение количества записей',
  })
  @ApiResponse({
    status: 200,
    description: 'История эволюции специализации',
    type: [Object],
  })
  async getSpecializationEvolution(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Query('limit') limit?: number,
  ) {
    const profile = await this.specializationService.getSpecializationProfile(characterId);

    if (!profile.dynamicSpecialization) {
      return [];
    }

    const evolution = profile.dynamicSpecialization.evolutionHistory;

    if (limit && limit > 0) {
      return evolution.slice(-limit).reverse(); // Последние N записей в обратном порядке
    }

    return evolution.reverse(); // Все записи в обратном порядке (новые сначала)
  }

  /**
   * Получить прогресс обучения по конкретному домену
   */
  @Get('learning-progress/:domain')
  @ApiOperation({ summary: 'Получить прогресс обучения персонажа в конкретном домене' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа', type: 'number' })
  @ApiParam({
    name: 'domain',
    description: 'Домен знаний',
    enum: Object.values(KnowledgeDomain),
  })
  @ApiResponse({
    status: 200,
    description: 'Прогресс обучения в домене',
    type: Object,
  })
  async getLearningProgress(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Param('domain') domain: KnowledgeDomain,
  ) {
    const profile = await this.specializationService.getSpecializationProfile(characterId);

    if (!profile.dynamicSpecialization) {
      return null;
    }

    return profile.dynamicSpecialization.learningProgress[domain] || null;
  }

  /**
   * Анализировать совместимость типов специализации
   */
  @Post('compatibility-analysis')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Анализировать совместимость двух типов специализации' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        primaryType: {
          type: 'string',
          enum: Object.values(SpecializationType),
          description: 'Первичный тип специализации',
        },
        secondaryType: {
          type: 'string',
          enum: Object.values(SpecializationType),
          description: 'Вторичный тип специализации',
        },
      },
      required: ['primaryType', 'secondaryType'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Результат анализа совместимости',
    type: Object,
  })
  async analyzeCompatibility(
    @Body() body: { primaryType: SpecializationType; secondaryType: SpecializationType },
  ) {
    return this.specializationService.analyzeSpecializationCompatibility(
      body.primaryType,
      body.secondaryType,
    );
  }

  /**
   * Создать оптимальную комбинацию специализаций
   */
  @Post('optimal-combination')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Создать оптимальную комбинацию специализаций для персонажа' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа', type: 'number' })
  @ApiResponse({
    status: 201,
    description: 'Оптимальная комбинация создана',
    type: Object,
  })
  async createOptimalCombination(@Param('characterId', ParseIntPipe) characterId: number) {
    const optimalCombination =
      await this.specializationService.createOptimalSpecializationCombination(characterId);

    // Создаем динамическую специализацию с оптимальной комбинацией
    const dynamicSpecialization = this.specializationService.createDynamicSpecialization(
      characterId,
      optimalCombination,
    );

    // Обновляем профиль персонажа
    await this.specializationService.updateSpecializationProfile(characterId, {
      specializationCombination: optimalCombination,
      dynamicSpecialization,
    });

    return {
      combination: optimalCombination,
      dynamicSpecialization,
    };
  }

  /**
   * Получить предложения по улучшению специализации
   */
  @Get('improvement-suggestions')
  @ApiOperation({ summary: 'Получить предложения по улучшению специализации персонажа' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа', type: 'number' })
  @ApiQuery({
    name: 'priority',
    required: false,
    enum: ['low', 'medium', 'high'],
    description: 'Фильтр по приоритету предложений',
  })
  @ApiResponse({
    status: 200,
    description: 'Предложения по улучшению специализации',
    type: [Object],
  })
  async getImprovementSuggestions(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Query('priority') priority?: 'low' | 'medium' | 'high',
  ) {
    const suggestions =
      await this.specializationService.getSpecializationImprovementSuggestions(characterId);

    if (priority) {
      return suggestions.filter(suggestion => suggestion.priority === priority);
    }

    return suggestions;
  }

  /**
   * Получить аналитику эффективности специализации
   */
  @Get('analytics')
  @ApiOperation({ summary: 'Получить аналитику эффективности специализации персонажа' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа', type: 'number' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['week', 'month', 'quarter', 'year'],
    description: 'Период для анализа',
  })
  @ApiResponse({
    status: 200,
    description: 'Аналитика эффективности специализации',
    type: Object,
  })
  async getSpecializationAnalytics(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Query('period') period: 'week' | 'month' | 'quarter' | 'year' = 'month',
  ) {
    const profile = await this.specializationService.getSpecializationProfile(characterId);

    if (!profile.dynamicSpecialization) {
      return null;
    }

    const dynamic = profile.dynamicSpecialization;
    const combination = profile.specializationCombination;

    // Вычисляем различные метрики
    const analytics = {
      characterId,
      period,
      generatedAt: new Date(),
      combination,
      overallEfficiency: this.calculateOverallEfficiency(dynamic),
      domainProgress: this.analyzeDomainProgress(dynamic, period),
      learningTrends: this.calculateLearningTrends(dynamic, period),
      adaptationEvents: this.getRecentAdaptations(dynamic, period),
      recommendations:
        await this.specializationService.getSpecializationRecommendations(characterId),
      improvementSuggestions:
        await this.specializationService.getSpecializationImprovementSuggestions(characterId),
    };

    return analytics;
  }

  // Приватные методы для аналитики

  private calculateOverallEfficiency(dynamic: DynamicSpecialization): number {
    const progresses = Object.values(dynamic.learningProgress);
    if (progresses.length === 0) return 0;

    const totalEfficiency = progresses.reduce((sum, progress) => {
      const levelScore = this.getLevelScore(progress.currentLevel);
      const rateMultiplier = Math.min(progress.learningRate, 2.0) / 2.0;
      const plateauPenalty = progress.plateau ? 0.8 : 1.0;

      return sum + levelScore * rateMultiplier * plateauPenalty;
    }, 0);

    return totalEfficiency / progresses.length;
  }

  private getLevelScore(level: CompetenceLevel): number {
    const scores = {
      [CompetenceLevel.NONE]: 0,
      [CompetenceLevel.BASIC]: 0.2,
      [CompetenceLevel.INTERMEDIATE]: 0.5,
      [CompetenceLevel.PROFICIENT]: 0.7,
      [CompetenceLevel.ADVANCED]: 0.9,
      [CompetenceLevel.EXPERT]: 1.0,
    };
    return scores[level];
  }

  private analyzeDomainProgress(
    dynamic: DynamicSpecialization,
    period: string,
  ): Record<string, any> {
    const domainAnalysis: Record<string, any> = {};

    Object.entries(dynamic.learningProgress).forEach(([domain, progress]) => {
      domainAnalysis[domain] = {
        currentLevel: progress.currentLevel,
        experiencePoints: progress.experiencePoints,
        interactionCount: progress.interactionCount,
        learningRate: progress.learningRate,
        plateau: progress.plateau,
        efficiency:
          this.getLevelScore(progress.currentLevel) *
          (progress.learningRate / 2.0) *
          (progress.plateau ? 0.8 : 1.0),
      };
    });

    return domainAnalysis;
  }

  private calculateLearningTrends(
    dynamic: DynamicSpecialization,
    period: string,
  ): Record<string, 'improving' | 'stable' | 'declining'> {
    const trends: Record<string, 'improving' | 'stable' | 'declining'> = {};

    Object.entries(dynamic.learningProgress).forEach(([domain, progress]) => {
      // Упрощенный анализ тренда на основе текущего состояния
      if (progress.plateau) {
        trends[domain] = 'stable';
      } else if (progress.learningRate > 1.2) {
        trends[domain] = 'improving';
      } else if (progress.learningRate < 0.8) {
        trends[domain] = 'declining';
      } else {
        trends[domain] = 'stable';
      }
    });

    return trends;
  }

  private getRecentAdaptations(dynamic: DynamicSpecialization, period: string): any[] {
    const periodDays = {
      week: 7,
      month: 30,
      quarter: 90,
      year: 365,
    };

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays[period]);

    return dynamic.evolutionHistory.filter(evolution => evolution.timestamp >= cutoffDate);
  }
}

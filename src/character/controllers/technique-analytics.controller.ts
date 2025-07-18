import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TechniqueHistoryService } from '../services/technique/technique-history.service';
import { TechniqueExecutorService } from '../services/technique/technique-executor.service';
import { ManipulativeTechniqueType } from '../enums/technique.enums';

/**
 * Контроллер для аналитики и управления техниками влияния
 */
@ApiTags('Technique Analytics')
@Controller('technique-analytics')
@UseGuards(JwtAuthGuard)
export class TechniqueAnalyticsController {
  constructor(
    private readonly historyService: TechniqueHistoryService,
    private readonly executorService: TechniqueExecutorService,
  ) {}

  /**
   * Получить историю выполнения техник для персонажа
   */
  @Get('character/:characterId/history')
  @ApiOperation({ summary: 'Получить историю техник персонажа' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа' })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество записей (по умолчанию 10)' })
  @ApiResponse({ status: 200, description: 'История техник получена успешно' })
  async getCharacterTechniqueHistory(
    @Param('characterId') characterId: string,
    @Query('limit') limit?: number,
  ) {
    return this.historyService.getHistory(characterId, limit || 10);
  }

  /**
   * Получить статистику по технике
   */
  @Get('character/:characterId/statistics')
  @ApiOperation({ summary: 'Получить статистику по техникам персонажа' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа' })
  @ApiQuery({ name: 'techniqueType', required: false, description: 'Тип техники для фильтрации' })
  @ApiResponse({ status: 200, description: 'Статистика получена успешно' })
  async getTechniqueStatistics(
    @Param('characterId') characterId: string,
    @Query('techniqueType') techniqueType?: ManipulativeTechniqueType,
  ) {
    return this.historyService.getTechniqueStatistics(characterId, techniqueType);
  }

  /**
   * Получить рекомендации по техникам
   */
  @Get('character/:characterId/user/:userId/recommendations')
  @ApiOperation({ summary: 'Получить рекомендации по техникам для пользователя' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа' })
  @ApiParam({ name: 'userId', description: 'ID пользователя' })
  @ApiResponse({ status: 200, description: 'Рекомендации получены успешно' })
  async getTechniqueRecommendations(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() context?: any,
  ) {
    return this.historyService.getTechniqueRecommendations(characterId, userId, context);
  }

  /**
   * Получить полную аналитику по техникам персонажа
   */
  @Get('character/:characterId/analytics')
  @ApiOperation({ summary: 'Получить полную аналитику по техникам персонажа' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа' })
  @ApiResponse({ status: 200, description: 'Аналитика получена успешно' })
  async getCharacterAnalytics(@Param('characterId', ParseIntPipe) characterId: number) {
    return this.historyService.getCharacterTechniqueAnalytics(characterId);
  }

  /**
   * Получить статистику по технике от TechniqueExecutorService
   */
  @Get('character/:characterId/executor-statistics')
  @ApiOperation({ summary: 'Получить статистику выполнения техник' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа' })
  @ApiQuery({ name: 'techniqueType', required: false, description: 'Тип техники для фильтрации' })
  @ApiResponse({ status: 200, description: 'Статистика выполнения получена успешно' })
  async getExecutorStatistics(
    @Param('characterId') characterId: string,
    @Query('techniqueType') techniqueType?: ManipulativeTechniqueType,
  ) {
    return this.executorService.getTechniqueStatistics(characterId, techniqueType);
  }

  /**
   * Получить историю техник от TechniqueExecutorService
   */
  @Get('character/:characterId/executor-history')
  @ApiOperation({ summary: 'Получить историю выполнения техник' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа' })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество записей (по умолчанию 10)' })
  @ApiResponse({ status: 200, description: 'История выполнения получена успешно' })
  async getExecutorHistory(
    @Param('characterId') characterId: string,
    @Query('limit') limit?: number,
  ) {
    return this.executorService.getTechniqueHistory(characterId, limit || 10);
  }

  /**
   * Записать выполнение техники вручную (для тестирования)
   */
  @Post('character/:characterId/record-execution')
  @ApiOperation({ summary: 'Записать выполнение техники' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа' })
  @ApiResponse({ status: 201, description: 'Выполнение техники записано успешно' })
  async recordTechniqueExecution(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body()
    executionData: {
      techniqueType: ManipulativeTechniqueType;
      userId: number;
      message: string;
      success: boolean;
      effectiveness?: number;
      ethicalScore?: number;
      sideEffects?: string[];
      executionContext?: any;
    },
  ) {
    await this.historyService.recordTechniqueExecution({
      ...executionData,
      characterId,
    });

    return { success: true, message: 'Выполнение техники записано успешно' };
  }

  /**
   * Получить сравнительную аналитику техник
   */
  @Get('character/:characterId/comparative-analytics')
  @ApiOperation({ summary: 'Получить сравнительную аналитику техник' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа' })
  @ApiQuery({
    name: 'techniques',
    required: false,
    description: 'Список техник для сравнения (через запятую)',
  })
  @ApiResponse({ status: 200, description: 'Сравнительная аналитика получена успешно' })
  async getComparativeAnalytics(
    @Param('characterId') characterId: string,
    @Query('techniques') techniques?: string,
  ) {
    const techniquesList = techniques
      ? (techniques.split(',') as ManipulativeTechniqueType[])
      : undefined;

    if (techniquesList) {
      const comparativeData = await Promise.all(
        techniquesList.map(async technique => {
          const stats = await this.historyService.getTechniqueStatistics(characterId, technique);
          return {
            technique,
            ...stats,
          };
        }),
      );

      return {
        techniques: comparativeData,
        summary: {
          totalTechniques: comparativeData.length,
          bestTechnique: comparativeData.reduce((best, current) =>
            current.averageEffectiveness > best.averageEffectiveness ? current : best,
          ),
          worstTechnique: comparativeData.reduce((worst, current) =>
            current.averageEffectiveness < worst.averageEffectiveness ? current : worst,
          ),
        },
      };
    }

    // Если техники не указаны, возвращаем общую аналитику
    return this.historyService.getCharacterTechniqueAnalytics(parseInt(characterId));
  }

  /**
   * Получить тренды использования техник
   */
  @Get('character/:characterId/trends')
  @ApiOperation({ summary: 'Получить тренды использования техник' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа' })
  @ApiQuery({ name: 'period', required: false, description: 'Период анализа (7d, 30d, 90d)' })
  @ApiResponse({ status: 200, description: 'Тренды получены успешно' })
  async getTechniquesTrends(
    @Param('characterId') characterId: string,
    @Query('period') period: string = '30d',
  ) {
    const stats = await this.historyService.getTechniqueStatistics(characterId);
    const analytics = await this.historyService.getCharacterTechniqueAnalytics(
      parseInt(characterId),
    );

    return {
      period,
      trendsData: stats.trendsData,
      trendsAnalysis: analytics.trendsAnalysis,
      summary: {
        totalExecutions: stats.totalExecutions,
        averageEffectiveness: stats.averageEffectiveness,
        successRate: stats.successRate,
        mostUsedTechnique: analytics.mostUsedTechnique,
        mostEffectiveTechnique: analytics.mostEffectiveTechnique,
      },
    };
  }

  /**
   * Получить этическую оценку техник
   */
  @Get('character/:characterId/ethical-analysis')
  @ApiOperation({ summary: 'Получить этическую оценку техник персонажа' })
  @ApiParam({ name: 'characterId', description: 'ID персонажа' })
  @ApiResponse({ status: 200, description: 'Этическая оценка получена успешно' })
  async getEthicalAnalysis(@Param('characterId') characterId: string) {
    const stats = await this.historyService.getTechniqueStatistics(characterId);
    const analytics = await this.historyService.getCharacterTechniqueAnalytics(
      parseInt(characterId),
    );

    return {
      averageEthicalScore: analytics.averageEthicalScore,
      ethicalRating: this.getEthicalRating(analytics.averageEthicalScore),
      recommendations: this.getEthicalRecommendations(analytics.averageEthicalScore),
      commonSideEffects: stats.commonSideEffects,
      totalExecutions: stats.totalExecutions,
    };
  }

  /**
   * Получить рейтинг этичности
   */
  private getEthicalRating(score: number): string {
    if (score >= 80) return 'Высокая этичность';
    if (score >= 60) return 'Средняя этичность';
    if (score >= 40) return 'Низкая этичность';
    return 'Неэтичное поведение';
  }

  /**
   * Получить рекомендации по этичности
   */
  private getEthicalRecommendations(score: number): string[] {
    if (score >= 80) {
      return ['Продолжайте использовать этичные подходы', 'Поддерживайте высокие стандарты'];
    }
    if (score >= 60) {
      return ['Рассмотрите более этичные альтернативы', 'Уменьшите интенсивность техник'];
    }
    if (score >= 40) {
      return ['Необходимо пересмотреть подход', 'Сосредоточьтесь на позитивных техниках'];
    }
    return ['Критически низкий уровень этичности', 'Требуется немедленная корректировка'];
  }
}

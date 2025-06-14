import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { OptimizationService } from '../services/optimization.service';

interface DatabaseMetricsResponse {
  timestamp: Date;
  database: unknown[];
  status: 'active' | 'error';
  error?: string;
}

interface OptimizationRecommendationsResponse {
  timestamp: Date;
  recommendations: unknown[];
  total: number;
}

interface AnalyzeOptimizeResponse {
  success: boolean;
  timestamp: Date;
  recommendations: unknown[];
  applied: number;
  total: number;
  timeTaken: number;
}

interface OptimizeTableResponse {
  success: boolean;
  tableName: string;
  recommendations: unknown[];
  applied: number;
}

interface AutoOptimizerHistoryResponse {
  history: unknown[];
  actions: string[];
}

interface RunAutoOptimizerResponse {
  success: boolean;
  message: string;
  timestamp: Date;
  history: unknown[];
}

@ApiTags('Оптимизация базы данных')
@Controller('api/v1/database')
export class DatabaseOptimizerController {
  constructor(private readonly optimizationService: OptimizationService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Получение метрик базы данных' })
  @ApiResponse({ status: 200, description: 'Метрики успешно получены' })
  async getDatabaseMetrics(): Promise<DatabaseMetricsResponse> {
    // Возвращаем общую информацию о БД через оптимизационный сервис
    try {
      const recommendations = await this.optimizationService.getOptimizationRecommendations();
      return {
        timestamp: new Date(),
        database: recommendations.database,
        status: 'active',
      };
    } catch (error) {
      return {
        timestamp: new Date(),
        database: [],
        status: 'error',
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      };
    }
  }

  @Get('optimizer/recommendations')
  @ApiOperation({ summary: 'Получение рекомендаций по оптимизации' })
  @ApiResponse({ status: 200, description: 'Рекомендации успешно получены' })
  async getOptimizationRecommendations(): Promise<OptimizationRecommendationsResponse> {
    const recommendations = await this.optimizationService.getOptimizationRecommendations();
    return {
      timestamp: new Date(),
      recommendations: recommendations.database,
      total: recommendations.database.length,
    };
  }

  @Post('optimizer/analyze')
  @ApiOperation({ summary: 'Запуск анализа и получение рекомендаций по оптимизации' })
  @ApiResponse({ status: 200, description: 'Анализ успешно выполнен' })
  async analyzeAndOptimize(): Promise<AnalyzeOptimizeResponse> {
    const result = await this.optimizationService.optimizeDatabase();
    const recommendations = await this.optimizationService.getOptimizationRecommendations();

    return {
      success: result.optimized,
      timestamp: new Date(),
      recommendations: recommendations.database,
      applied: result.optimized ? 1 : 0,
      total: recommendations.database.length,
      timeTaken: 0,
    };
  }

  @Post('optimizer/table/:tableName')
  @ApiOperation({ summary: 'Оптимизация конкретной таблицы' })
  @ApiParam({ name: 'tableName', description: 'Название таблицы для оптимизации' })
  @ApiResponse({ status: 200, description: 'Таблица успешно оптимизирована' })
  async optimizeTable(@Param('tableName') tableName: string): Promise<OptimizeTableResponse> {
    const result = await this.optimizationService.optimizeDatabase();
    const recommendations = await this.optimizationService.getOptimizationRecommendations();

    return {
      success: result.optimized,
      tableName,
      recommendations: recommendations.database,
      applied: result.optimized ? 1 : 0,
    };
  }

  @Get('auto-optimizer/history')
  @ApiOperation({ summary: 'Получение истории автоматических оптимизаций' })
  @ApiResponse({ status: 200, description: 'История успешно получена' })
  async getAutoOptimizerHistory(): Promise<AutoOptimizerHistoryResponse> {
    return {
      history: [],
      actions: ['database_optimization', 'query_analysis', 'statistics_update'],
    };
  }

  @Post('auto-optimizer/run')
  @ApiOperation({ summary: 'Запуск автоматической оптимизации вручную' })
  @ApiResponse({ status: 200, description: 'Автоматическая оптимизация запущена' })
  async runAutoOptimizer(): Promise<RunAutoOptimizerResponse> {
    const result = await this.optimizationService.runFullOptimization();

    return {
      success: result.database.optimized,
      message: result.database.message,
      timestamp: new Date(),
      history: [],
    };
  }
}

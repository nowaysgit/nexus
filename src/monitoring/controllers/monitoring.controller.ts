import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  InternalServerErrorException,
  NotFoundException,
  Header,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MonitoringService, SystemMetric } from '../monitoring.service';
import { AlertService } from '../services/alert.service';
import { OptimizationService } from '../services/optimization.service';

import { Alert, AlertType, AlertSeverity, AlertStatus } from '../entities/alert.entity';
import { MessageQueueService } from '../../message-queue/message-queue.service';
import { LogService } from '../../logging/log.service';
import * as client from 'prom-client';

/**
 * Упрощенный контроллер мониторинга
 */
@ApiTags('Мониторинг')
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly alertService: AlertService,
    private readonly optimizationService: OptimizationService,
    private readonly messageQueueService: MessageQueueService,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(MonitoringController.name);
    // Инициализируем prom-client при первом создании контроллера
    if (!client.register.getSingleMetric('process_start_time_seconds')) {
      client.collectDefaultMetrics();
    }
  }

  /**
   * Безопасно форматирует ошибку для логирования
   */
  private formatError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    if (typeof error === 'object' && error !== null) {
      try {
        return { ...(error as Record<string, unknown>) };
      } catch {
        return { error: '[Не удалось сериализовать объект]' };
      }
    }

    return { error: typeof error === 'string' ? error : JSON.stringify(error) };
  }

  // =========== Метрики ===========

  @Get('metrics/system')
  @ApiOperation({ summary: 'Получить системные метрики' })
  async getSystemMetrics(
    @Query('limit') limit?: number,
    @Query('metricType') metricType?: string,
  ): Promise<SystemMetric[]> {
    try {
      return this.monitoringService.getMetrics(metricType || 'system', limit || 100);
    } catch (error) {
      this.logService.error('Ошибка при получении системных метрик', this.formatError(error));
      throw new InternalServerErrorException('Не удалось получить системные метрики');
    }
  }

  @Get('metrics/api')
  @ApiOperation({ summary: 'Получить метрики API' })
  async getApiMetrics(
    @Query('limit') limit?: number,
    @Query('endpoint') endpoint?: string,
  ): Promise<SystemMetric[]> {
    try {
      return this.monitoringService.getMetrics(endpoint || 'api', limit || 100);
    } catch (error) {
      this.logService.error('Ошибка при получении метрик API', this.formatError(error));
      throw new InternalServerErrorException('Не удалось получить метрики API');
    }
  }

  @Get('metrics/stats/:metricName')
  @ApiOperation({ summary: 'Получить статистику метрики' })
  async getMetricStats(
    @Param('metricName') metricName: string,
    @Query('hours') hours?: number,
  ): Promise<Record<string, unknown>> {
    try {
      const stats = this.monitoringService.getMetricStats(
        metricName,
        (hours || 24) * 60 * 60 * 1000,
      );
      return stats as Record<string, unknown>;
    } catch (error) {
      this.logService.error('Ошибка при получении статистики метрики', this.formatError(error));
      throw new InternalServerErrorException('Не удалось получить статистику');
    }
  }

  // =========== Prometheus ===========

  @Get('metrics')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOperation({ summary: 'Получить метрики в формате Prometheus' })
  async getMetrics(): Promise<string> {
    try {
      return await client.register.metrics();
    } catch (error) {
      this.logService.error('Ошибка при получении Prometheus метрик', this.formatError(error));
      throw new InternalServerErrorException('Не удалось получить метрики');
    }
  }

  // =========== Оповещения ===========

  @Get('alerts')
  @ApiOperation({ summary: 'Получить список оповещений' })
  async getAlerts(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('type') type?: AlertType,
    @Query('severity') severity?: AlertSeverity,
    @Query('status') status?: AlertStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<Alert[]> {
    try {
      return await this.alertService.getAlerts(
        {
          type,
          severity,
          status,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
        },
        limit,
        offset,
      );
    } catch (error) {
      this.logService.error('Ошибка при получении оповещений', this.formatError(error));
      throw new InternalServerErrorException('Не удалось получить оповещения');
    }
  }

  @Post('alerts/:id/acknowledge')
  @ApiOperation({ summary: 'Подтвердить оповещение' })
  async acknowledgeAlert(
    @Param('id', ParseIntPipe) alertId: number,
    @Body('user') user: string,
  ): Promise<Alert> {
    try {
      const alert = await this.alertService.acknowledgeAlert(alertId, user);
      if (!alert) {
        throw new NotFoundException(`Оповещение с ID ${alertId} не найдено`);
      }
      return alert;
    } catch (error) {
      this.logService.error(
        `Ошибка при подтверждении оповещения ${alertId}`,
        this.formatError(error),
      );
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Не удалось подтвердить оповещение');
    }
  }

  @Post('alerts/:id/resolve')
  @ApiOperation({ summary: 'Решить оповещение' })
  async resolveAlert(
    @Param('id', ParseIntPipe) alertId: number,
    @Body('user') user: string,
  ): Promise<Alert> {
    try {
      const alert = await this.alertService.resolveAlert(alertId, user);
      if (!alert) {
        throw new NotFoundException(`Оповещение с ID ${alertId} не найдено`);
      }
      return alert;
    } catch (error) {
      this.logService.error(`Ошибка при разрешении оповещения ${alertId}`, this.formatError(error));
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Не удалось разрешить оповещение');
    }
  }

  // =========== Оптимизация ===========

  @Get('optimization/recommendations')
  @ApiOperation({ summary: 'Получить рекомендации по оптимизации' })
  async getOptimizationRecommendations(): Promise<{
    database: string[];
    scaling: string[];
    general: string[];
  }> {
    try {
      return await this.optimizationService.getOptimizationRecommendations();
    } catch (error) {
      this.logService.error('Ошибка при получении рекомендаций', this.formatError(error));
      throw new InternalServerErrorException('Не удалось получить рекомендации');
    }
  }

  @Post('optimization/database')
  @ApiOperation({ summary: 'Запустить оптимизацию базы данных' })
  async optimizeDatabase(): Promise<{
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
  }> {
    try {
      const result = await this.optimizationService.optimizeDatabase();
      return {
        success: result.optimized,
        message: result.message,
        details: result.details,
      };
    } catch (error) {
      this.logService.error('Ошибка при оптимизации БД', this.formatError(error));
      throw new InternalServerErrorException('Не удалось выполнить оптимизацию');
    }
  }

  @Post('optimization/full')
  @ApiOperation({ summary: 'Запустить полную оптимизацию' })
  async runFullOptimization(@Query('currentLoad') currentLoad?: number): Promise<{
    success: boolean;
    database: import('../services/optimization.service').DatabaseOptimizationResult;
    scaling: import('../services/optimization.service').ScalingResult;
  }> {
    try {
      const result = await this.optimizationService.runFullOptimization(currentLoad);
      return {
        success: true,
        database: result.database,
        scaling: result.scaling,
      };
    } catch (error) {
      this.logService.error('Ошибка при полной оптимизации', this.formatError(error));
      throw new InternalServerErrorException('Не удалось выполнить полную оптимизацию');
    }
  }
}

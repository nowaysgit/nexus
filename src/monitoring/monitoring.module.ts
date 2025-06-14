import { Module, NestModule, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TelegramModule } from '../telegram/telegram.module';
import { CommonModule } from '../common/common.module';
import { LoggingModule } from '../logging';
import { ErrorHandlingModule } from '../common/utils/error-handling/error-handling.module';
import { CharacterModule } from '../character/character.module';
import { LogService } from '../logging/log.service';

// Контроллеры
import { DatabaseOptimizerController } from './controllers/optimizer.controller';
import { MonitoringController } from './controllers/monitoring.controller';

// Основные сервисы мониторинга
import { MonitoringService } from './monitoring.service';

import { AlertService } from './services/alert.service';
import { OptimizationService } from './services/optimization.service';

// Сущности
import { SystemMetric } from './entities/system-metric.entity';
import { ApiMetric } from './entities/api-metric.entity';
import { Alert } from './entities/alert.entity';
import { ScalingRule } from './entities/scaling-rule.entity';
import { ScalingOperation } from './entities/scaling-operation.entity';
import { OptimizerRecommendation } from './entities/optimizer-recommendation.entity';

// Модули

/**
 * Упрощенный модуль мониторинга системы
 * Объединяет метрики, алерты и оптимизацию в единой структуре
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemMetric,
      ApiMetric,
      Alert,
      OptimizerRecommendation,
      ScalingRule,
      ScalingOperation,
    ]),
    ConfigModule,
    ScheduleModule.forRoot(),
    TelegramModule,
    CommonModule,
    LoggingModule,
    ErrorHandlingModule,
    CharacterModule,
  ],
  controllers: [DatabaseOptimizerController, MonitoringController],
  providers: [
    // Основной сервис мониторинга
    MonitoringService,

    // Сервисы метрик

    // Сервис алертов
    AlertService,

    // Сервисы оптимизации
    OptimizationService,
  ],
  exports: [MonitoringService, AlertService, OptimizationService],
})
export class MonitoringModule implements NestModule {
  constructor(
    private readonly configService: ConfigService,
    private readonly logService: LogService,
  ) {
    this.logService.setContext(MonitoringModule.name);
  }

  configure(): void {
    // Применяем middleware только если мониторинг метрик включен
    const metricsEnabled = this.configService.get<boolean>(
      'monitoring.metrics.prometheus.enabled',
      false,
    );

    if (metricsEnabled) {
      // Базовый мониторинг без middleware для упрощения
      this.logService.log('Metrics monitoring enabled');
    }
  }
}

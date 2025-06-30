import { Module, DynamicModule } from '@nestjs/common';
import { MockLogService } from './log.service.mock';
import { LogService } from '../../../src/logging/log.service';

// Моки для сервисов мониторинга
export const mockMonitoringService = {
  getSystemStatus: jest.fn().mockResolvedValue({
    status: 'healthy',
    uptime: 1000,
    timestamp: new Date(),
  }),
  getMetrics: jest.fn().mockResolvedValue({
    cpu: 50,
    memory: 60,
    disk: 30,
  }),
  logMetric: jest.fn().mockResolvedValue(true),
  checkHealth: jest.fn().mockResolvedValue(true),
};

export const mockAlertService = {
  createAlert: jest.fn().mockResolvedValue({
    id: 1,
    type: 'SYSTEM',
    severity: 'LOW',
    title: 'Test Alert',
    message: 'Test alert message',
  }),
  getAlerts: jest.fn().mockResolvedValue([]),
  acknowledgeAlert: jest.fn().mockResolvedValue(true),
  resolveAlert: jest.fn().mockResolvedValue(true),
  getAlertStats: jest.fn().mockResolvedValue({
    total: 0,
    byStatus: {},
    bySeverity: {},
    byType: {},
  }),
};

export const mockOptimizationService = {
  optimizeDatabase: jest.fn().mockResolvedValue({
    success: true,
    recommendations: [],
  }),
  getOptimizationStats: jest.fn().mockResolvedValue({
    lastOptimization: new Date(),
    totalOptimizations: 0,
  }),
  createRecommendation: jest.fn().mockResolvedValue({
    id: 1,
    type: 'INDEX',
    description: 'Test recommendation',
  }),
};

/**
 * Мок-модуль для мониторинга, который можно использовать в тестах
 * Предоставляет моки для всех сервисов мониторинга без зависимости от TelegramModule
 */
@Module({})
export class MockMonitoringModule {
  /**
   * Создает динамический модуль с моками для мониторинга
   * @returns DynamicModule с моками для мониторинга
   */
  static forRoot(): DynamicModule {
    return {
      module: MockMonitoringModule,
      providers: [
        {
          provide: 'MonitoringService',
          useValue: mockMonitoringService,
        },
        {
          provide: 'AlertService',
          useValue: mockAlertService,
        },
        {
          provide: 'OptimizationService',
          useValue: mockOptimizationService,
        },
        {
          provide: LogService,
          useClass: MockLogService,
        },
      ],
      exports: ['MonitoringService', 'AlertService', 'OptimizationService', LogService],
    };
  }
}

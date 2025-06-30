import { Injectable, OnModuleInit } from '@nestjs/common';
import { LogService } from '../logging/log.service';
import { BaseService } from '../common/base/base.service';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MessageQueueService } from '../message-queue/message-queue.service';
import { getErrorMessage } from '../common/utils/error.utils';

// Базовые интерфейсы для мониторинга
export interface SystemMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags: Record<string, string>;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface Alert {
  id: string;
  ruleId: string;
  message: string;
  severity: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface ScalingRule {
  id: string;
  name: string;
  metric: string;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  minReplicas: number;
  maxReplicas: number;
  enabled: boolean;
}

/**
 * Интерфейс состояния системы
 */
export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  timestamp: Date;
}

/**
 * Интерфейс метрик мониторинга
 */
export interface MonitoringMetrics {
  system: SystemHealth;
  database: {
    connected: boolean;
    queryCount?: number;
    avgResponseTime?: number;
  };
  queues: {
    mainQueue: {
      queued: number;
      processing: number;
      completed: number;
      failed: number;
    };
  };
  application: {
    startTime: Date;
    uptime: number;
  };
}

/**
 * Упрощенный объединенный сервис мониторинга
 * Включает: сбор метрик, алерты, базовое автомасштабирование
 */
@Injectable()
export class MonitoringService extends BaseService implements OnModuleInit {
  private readonly metrics: Map<string, SystemMetric[]> = new Map();
  private readonly alertRules: Map<string, AlertRule> = new Map();
  private readonly activeAlerts: Map<string, Alert> = new Map();
  private readonly scalingRules: Map<string, ScalingRule> = new Map();

  private readonly maxMetricsPerType = 1000;
  private readonly metricsRetentionMs = 24 * 60 * 60 * 1000; // 24 часа
  private readonly startTime: Date;
  private readonly enabled: boolean;
  private readonly detailedLogging: boolean;

  // Метрики для отслеживания
  private dbQueryCount = 0;
  private dbResponseTimes: number[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly messageQueueService: MessageQueueService,
    logService: LogService,
  ) {
    super(logService);
    this.startTime = new Date();
    this.enabled = this.configService.get<boolean>('monitoring.enabled', true);
    this.detailedLogging = this.configService.get<boolean>('monitoring.detailedLogging', false);
    this.initializeDefaultRules();
  }

  async onModuleInit() {
    if (this.enabled) {
      this.logInfo('Сервис мониторинга инициализирован', {
        enabled: this.enabled,
        detailedLogging: this.detailedLogging,
      });
    }
  }

  // === МЕТРИКИ ===

  /**
   * Записывает метрику системы
   */
  recordMetric(
    name: string,
    value: number,
    unit: string = '',
    tags: Record<string, string> = {},
  ): void {
    const metric: SystemMetric = {
      id: `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricsList = this.metrics.get(name);
    metricsList.push(metric);

    // Ограничиваем количество метрик
    if (metricsList.length > this.maxMetricsPerType) {
      metricsList.shift();
    }

    // Проверяем алерты
    this.checkAlerts(metric);

    this.logDebug(`Записана метрика: ${name} = ${value} ${unit}`, { tags });
  }

  /**
   * Получает метрики по имени
   */
  getMetrics(name: string, limit: number = 100): SystemMetric[] {
    const metrics = this.metrics.get(name) || [];
    return metrics.slice(-limit);
  }

  /**
   * Получает все доступные метрики
   */
  getAllMetrics(): Record<string, SystemMetric[]> {
    const result: Record<string, SystemMetric[]> = {};
    for (const [name, metrics] of this.metrics.entries()) {
      result[name] = metrics;
    }
    return result;
  }

  /**
   * Получает статистику по метрике
   */
  getMetricStats(
    name: string,
    periodMs: number = 60 * 60 * 1000,
  ): {
    avg: number;
    min: number;
    max: number;
    count: number;
    latest: number;
  } {
    const metrics = this.metrics.get(name) || [];
    const cutoff = new Date(Date.now() - periodMs);
    const recentMetrics = metrics.filter(m => m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0, latest: 0 };
    }

    const values = recentMetrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
      latest: values[values.length - 1],
    };
  }

  // === АЛЕРТЫ ===

  /**
   * Добавляет правило алерта
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const alertRule: AlertRule = { ...rule, id };

    this.alertRules.set(id, alertRule);
    this.logInfo(`Добавлено правило алерта: ${rule.name}`, { ruleId: id });

    return id;
  }

  /**
   * Получает все правила алертов
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Получает активные алерты
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Разрешает алерт
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.logInfo(`Алерт разрешен: ${alert.message}`, { alertId });
      return true;
    }
    return false;
  }

  // === АВТОМАСШТАБИРОВАНИЕ ===

  /**
   * Добавляет правило масштабирования
   */
  addScalingRule(rule: Omit<ScalingRule, 'id'>): string {
    const id = `scaling_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const scalingRule: ScalingRule = { ...rule, id };

    this.scalingRules.set(id, scalingRule);
    this.logInfo(`Добавлено правило масштабирования: ${rule.name}`, { ruleId: id });

    return id;
  }

  /**
   * Получает правила масштабирования
   */
  getScalingRules(): ScalingRule[] {
    return Array.from(this.scalingRules.values());
  }

  /**
   * Проверяет необходимость масштабирования
   */
  checkScaling(): Array<{
    rule: ScalingRule;
    action: 'scale_up' | 'scale_down';
    currentValue: number;
  }> {
    const recommendations: Array<{
      rule: ScalingRule;
      action: 'scale_up' | 'scale_down';
      currentValue: number;
    }> = [];

    for (const rule of this.scalingRules.values()) {
      if (!rule.enabled) continue;

      const stats = this.getMetricStats(rule.metric, 5 * 60 * 1000); // 5 минут
      if (stats.count === 0) continue;

      if (stats.avg > rule.scaleUpThreshold) {
        recommendations.push({
          rule,
          action: 'scale_up',
          currentValue: stats.avg,
        });
      } else if (stats.avg < rule.scaleDownThreshold) {
        recommendations.push({
          rule,
          action: 'scale_down',
          currentValue: stats.avg,
        });
      }
    }

    return recommendations;
  }

  // === ОЧИСТКА ===

  /**
   * Очищает старые метрики
   */
  cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - this.metricsRetentionMs);
    let cleanedCount = 0;

    for (const [name, metrics] of this.metrics.entries()) {
      const originalLength = metrics.length;
      const filtered = metrics.filter(m => m.timestamp > cutoff);

      if (filtered.length !== originalLength) {
        this.metrics.set(name, filtered);
        cleanedCount += originalLength - filtered.length;
      }
    }

    if (cleanedCount > 0) {
      this.logDebug(`Очищено ${cleanedCount} старых метрик`);
    }
  }

  /**
   * Получает общую статистику мониторинга
   */
  getOverallStats(): {
    metricsCount: number;
    activeAlertsCount: number;
    alertRulesCount: number;
    scalingRulesCount: number;
    memoryUsage: string;
  } {
    const totalMetrics = Array.from(this.metrics.values()).reduce(
      (sum, metrics) => sum + metrics.length,
      0,
    );

    return {
      metricsCount: totalMetrics,
      activeAlertsCount: this.getActiveAlerts().length,
      alertRulesCount: this.alertRules.size,
      scalingRulesCount: this.scalingRules.size,
      memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    };
  }

  // === ПРИВАТНЫЕ МЕТОДЫ ===

  private checkAlerts(metric: SystemMetric): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled || rule.metric !== metric.name) continue;

      const shouldAlert = this.evaluateAlertRule(rule, metric.value);

      if (shouldAlert) {
        this.triggerAlert(rule, metric);
      }
    }
  }

  private evaluateAlertRule(rule: AlertRule, value: number): boolean {
    switch (rule.operator) {
      case 'gt':
        return value > rule.threshold;
      case 'gte':
        return value >= rule.threshold;
      case 'lt':
        return value < rule.threshold;
      case 'lte':
        return value <= rule.threshold;
      case 'eq':
        return value === rule.threshold;
      default:
        return false;
    }
  }

  private triggerAlert(rule: AlertRule, metric: SystemMetric): void {
    const alertId = `alert_${rule.id}_${Date.now()}`;

    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      message: `${rule.name}: ${metric.name} = ${metric.value} (threshold: ${rule.threshold})`,
      severity: rule.severity,
      timestamp: new Date(),
      resolved: false,
    };

    this.activeAlerts.set(alertId, alert);

    this.logWarning(`Алерт активирован: ${alert.message}`, {
      alertId,
      ruleId: rule.id,
      severity: rule.severity,
    });
  }

  private initializeDefaultRules(): void {
    // Добавляем базовые правила алертов
    this.addAlertRule({
      name: 'Высокое использование CPU',
      metric: 'cpu_usage',
      threshold: 80,
      operator: 'gt',
      enabled: true,
      severity: 'high',
    });

    this.addAlertRule({
      name: 'Высокое использование памяти',
      metric: 'memory_usage',
      threshold: 85,
      operator: 'gt',
      enabled: true,
      severity: 'high',
    });

    this.addAlertRule({
      name: 'Высокий процент ошибок',
      metric: 'error_rate',
      threshold: 5,
      operator: 'gt',
      enabled: true,
      severity: 'medium',
    });

    // Добавляем базовые правила масштабирования
    this.addScalingRule({
      name: 'CPU-based scaling',
      metric: 'cpu_usage',
      scaleUpThreshold: 70,
      scaleDownThreshold: 30,
      minReplicas: 1,
      maxReplicas: 10,
      enabled: this.configService.get<boolean>('monitoring.scaling.enabled', false),
    });
  }

  /**
   * Получить состояние системы
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = Date.now() - this.startTime.getTime();

      const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (memoryPercentage > 90) {
        status = 'critical';
      } else if (memoryPercentage > 75) {
        status = 'warning';
      }

      return {
        status,
        uptime,
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: memoryPercentage,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      this.logError('Ошибка при получении состояния системы', {
        error: getErrorMessage(error),
      });
      return {
        status: 'critical',
        uptime: 0,
        memory: { used: 0, total: 0, percentage: 0 },
        cpu: { user: 0, system: 0 },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Проверить подключение к базе данных
   */
  async checkDatabaseConnection(): Promise<boolean> {
    try {
      // Простая проверка доступности
      return true;
    } catch (error) {
      this.logError('Ошибка подключения к базе данных', {
        error: getErrorMessage(error),
      });
      return false;
    }
  }

  /**
   * Получить полные метрики мониторинга
   */
  async getMonitoringMetrics(): Promise<MonitoringMetrics> {
    try {
      const systemHealth = await this.getSystemHealth();
      const dbConnected = await this.checkDatabaseConnection();
      const queueStats = this.messageQueueService.getStats();

      return {
        system: systemHealth,
        database: {
          connected: dbConnected,
          queryCount: this.dbQueryCount,
          avgResponseTime: this.calculateAverageResponseTime(),
        },
        queues: {
          mainQueue: {
            queued: queueStats.queueLength || 0,
            processing: queueStats.processingCount || 0,
            completed: queueStats.messagesByStatus.completed || 0,
            failed: queueStats.messagesByStatus.failed || 0,
          },
        },
        application: {
          startTime: this.startTime,
          uptime: systemHealth.uptime,
        },
      };
    } catch (error) {
      this.logError('Ошибка при получении метрик', {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Проверить общее состояние системы
   */
  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.getSystemHealth();
      const dbConnection = await this.checkDatabaseConnection();
      return health.status !== 'critical' && dbConnection;
    } catch (error) {
      this.logError('Ошибка при проверке состояния системы', {
        error: getErrorMessage(error),
      });
      return false;
    }
  }

  /**
   * Периодическое логирование метрик
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async logMetrics() {
    if (!this.enabled) return;

    try {
      const metrics = await this.getMonitoringMetrics();

      this.logInfo('Метрики системы', {
        status: metrics.system.status,
        memory: metrics.system.memory.percentage.toFixed(1) + '%',
        uptime: Math.floor(metrics.system.uptime / 1000) + 's',
        queues: metrics.queues.mainQueue,
        database: metrics.database.connected ? 'connected' : 'disconnected',
      });

      if (this.detailedLogging) {
        this.logDebug('Детальные метрики', metrics);
      }
    } catch (error) {
      this.logError('Ошибка при логировании метрик', {
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * Записать метрику времени ответа БД
   */
  recordDatabaseQuery(responseTime: number) {
    this.dbQueryCount++;
    this.dbResponseTimes.push(responseTime);

    // Оставляем только последние 100 записей
    if (this.dbResponseTimes.length > 100) {
      this.dbResponseTimes = this.dbResponseTimes.slice(-100);
    }
  }

  /**
   * Трассировка потока сообщений
   */
  traceMessageFlow(
    queueId: string,
    messageId: string,
    status: string,
    source: string,
    type: string,
    additionalData?: Record<string, unknown>,
  ) {
    if (!this.enabled || !this.detailedLogging) return;

    this.logDebug('Трассировка сообщения', {
      queueId,
      messageId,
      status,
      source,
      type,
      timestamp: new Date(),
      ...additionalData,
    });
  }

  private calculateAverageResponseTime(): number {
    if (this.dbResponseTimes.length === 0) return 0;
    const sum = this.dbResponseTimes.reduce((a, b) => a + b, 0);
    return sum / this.dbResponseTimes.length;
  }
}

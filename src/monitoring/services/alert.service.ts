import { Injectable, OnModuleInit } from '@nestjs/common';
import { LogService } from '../../logging/log.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Alert, AlertType, AlertSeverity, AlertStatus } from '../entities/alert.entity';
import { MessageQueueService, MessagePriority } from '../../message-queue/message-queue.service';
import { MessageContext } from '../../common/interfaces/message-processor.interface';
import { BaseService } from '../../common/base/base.service';
import { getErrorMessage } from '../../common/utils/error.utils';

export interface AlertFilter {
  type?: AlertType;
  severity?: AlertSeverity;
  status?: AlertStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface AlertConfiguration {
  enabled: boolean;
  channels: {
    slack: {
      enabled: boolean;
      webhookUrl: string;
      channel: string;
      username: string;
      iconEmoji: string;
    };
    pagerduty: {
      enabled: boolean;
      integrationKey: string;
      routingKey: string;
    };
  };
  thresholds: {
    cpu: number;
    memory: number;
    disk: number;
    database: number;
  };
}

interface AlertNotificationData {
  alert: Alert;
}

function isAlertNotificationData(data: unknown): data is AlertNotificationData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'alert' in data &&
    typeof (data as AlertNotificationData).alert === 'object'
  );
}

/**
 * Сервис управления алертами
 * Объединяет функциональность управления, уведомлений и конфигурации алертов
 */
@Injectable()
export class AlertService extends BaseService implements OnModuleInit {
  private readonly config: AlertConfiguration;

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly messageQueueService: MessageQueueService,
    logService: LogService,
  ) {
    super(logService);
    // Загрузка конфигурации
    this.config = this.loadConfiguration();
  }

  async onModuleInit(): Promise<void> {
    if (this.config.enabled) {
      this.logService.log('Система оповещений активирована');
      this.setupMonitoringTasks();
    } else {
      this.logService.log('Система оповещений отключена');
    }
  }

  // ============================================================================
  // УПРАВЛЕНИЕ АЛЕРТАМИ
  // ============================================================================

  /**
   * Создает новое оповещение и отправляет уведомления
   */
  async createAlert(
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    options?: {
      source?: string;
      data?: Record<string, unknown>;
      notificationChannels?: string[];
    },
  ): Promise<Alert | null> {
    return this.withErrorHandling('создании оповещения', async () => {
      if (!this.config.enabled) {
        return null;
      }

      // Создаем оповещение в БД
      const alert = Alert.create(type, severity, title, message, options);
      const savedAlert = await this.alertRepository.save(alert);

      this.logService.debug(`Создано оповещение: ${title} [ID: ${savedAlert.id}]`, {
        alertId: savedAlert.id,
        type,
        severity,
      });

      // Отправляем уведомления асинхронно через очередь
      await this.queueNotifications(savedAlert);

      return savedAlert;
    });
  }

  /**
   * Получает список оповещений с фильтрацией
   */
  async getAlerts(
    filter: AlertFilter = {},
    limit: number = 100,
    offset: number = 0,
  ): Promise<Alert[]> {
    return this.withErrorHandling('получении списка оповещений', async () => {
      const queryBuilder = this.alertRepository.createQueryBuilder('alert');

      if (filter.type) {
        queryBuilder.andWhere('alert.type = :type', { type: filter.type });
      }
      if (filter.severity) {
        queryBuilder.andWhere('alert.severity = :severity', { severity: filter.severity });
      }
      if (filter.status) {
        queryBuilder.andWhere('alert.status = :status', { status: filter.status });
      }
      if (filter.startDate) {
        queryBuilder.andWhere('alert.createdAt >= :startDate', { startDate: filter.startDate });
      }
      if (filter.endDate) {
        queryBuilder.andWhere('alert.createdAt <= :endDate', { endDate: filter.endDate });
      }

      queryBuilder.orderBy('alert.createdAt', 'DESC');
      queryBuilder.offset(offset).limit(limit);

      const alerts = await queryBuilder.getMany();
      this.logService.debug(`Получено ${alerts.length} оповещений`, { filter, limit, offset });

      return alerts;
    });
  }

  /**
   * Отмечает оповещение как просмотренное
   */
  async acknowledgeAlert(alertId: number, user: string): Promise<Alert | null> {
    return this.withErrorHandling('отметке оповещения как просмотренного', async () => {
      const alert = await this.alertRepository.findOne({ where: { id: alertId } });
      if (!alert) {
        this.logService.warn(`Оповещение с ID ${alertId} не найдено`);
        return null;
      }

      alert.status = AlertStatus.ACKNOWLEDGED;
      alert.acknowledgedBy = user;
      // alert.acknowledgedAt = new Date(); // Если поле есть в Alert entity

      const updatedAlert = await this.alertRepository.save(alert);
      this.logService.log(`Оповещение ${alertId} отмечено как просмотренное пользователем ${user}`);

      return updatedAlert;
    });
  }

  /**
   * Разрешает оповещение
   */
  async resolveAlert(alertId: number, user: string): Promise<Alert | null> {
    return this.withErrorHandling('разрешении оповещения', async () => {
      const alert = await this.alertRepository.findOne({ where: { id: alertId } });
      if (!alert) {
        this.logService.warn(`Оповещение с ID ${alertId} не найдено`);
        return null;
      }

      alert.status = AlertStatus.RESOLVED;
      alert.resolvedBy = user;
      // alert.resolvedAt = new Date(); // Если поле есть в Alert entity

      const updatedAlert = await this.alertRepository.save(alert);
      this.logService.log(`Оповещение ${alertId} разрешено пользователем ${user}`);

      return updatedAlert;
    });
  }

  /**
   * Игнорирует оповещение
   */
  async ignoreAlert(alertId: number): Promise<Alert | null> {
    return this.withErrorHandling('игнорировании оповещения', async () => {
      const alert = await this.alertRepository.findOne({ where: { id: alertId } });
      if (!alert) {
        this.logService.warn(`Оповещение с ID ${alertId} не найдено`);
        return null;
      }

      alert.status = AlertStatus.IGNORED;
      const updatedAlert = await this.alertRepository.save(alert);
      this.logService.log(`Оповещение ${alertId} проигнорировано`);

      return updatedAlert;
    });
  }

  /**
   * Очищает разрешенные оповещения старше указанного количества дней
   */
  async cleanupResolvedAlerts(daysToKeep: number = 30): Promise<void> {
    return this.withErrorHandling('очистке разрешенных оповещений', async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.alertRepository.delete({
        status: AlertStatus.RESOLVED,
        createdAt: LessThanOrEqual(cutoffDate),
      });

      this.logService.log(
        `Очищено ${result.affected} разрешенных оповещений старше ${daysToKeep} дней`,
      );
    });
  }

  /**
   * Получает оповещение по ID
   */
  async getAlertById(alertId: number): Promise<Alert | null> {
    return this.withErrorHandling('получении оповещения по ID', async () => {
      const alert = await this.alertRepository.findOne({ where: { id: alertId } });
      return alert || null;
    });
  }

  /**
   * Получает статистику оповещений
   */
  async getAlertStats(): Promise<{
    total: number;
    byStatus: Record<AlertStatus, number>;
    bySeverity: Record<AlertSeverity, number>;
    byType: Record<AlertType, number>;
  }> {
    return this.withErrorHandling('получении статистики оповещений', async () => {
      const alerts = await this.alertRepository.find();

      const stats = {
        total: alerts.length,
        byStatus: {} as Record<AlertStatus, number>,
        bySeverity: {} as Record<AlertSeverity, number>,
        byType: {} as Record<AlertType, number>,
      };

      // Инициализация счетчиков с проверкой типов
      for (const status of Object.values(AlertStatus)) {
        stats.byStatus[status] = 0;
      }
      for (const severity of Object.values(AlertSeverity)) {
        stats.bySeverity[severity] = 0;
      }
      for (const type of Object.values(AlertType)) {
        stats.byType[type] = 0;
      }

      // Подсчет статистики с безопасной проверкой
      alerts.forEach(alert => {
        if (alert.status in stats.byStatus) {
          stats.byStatus[alert.status]++;
        }
        if (alert.severity in stats.bySeverity) {
          stats.bySeverity[alert.severity]++;
        }
        if (alert.type in stats.byType) {
          stats.byType[alert.type]++;
        }
      });

      return stats;
    });
  }

  // ============================================================================
  // УВЕДОМЛЕНИЯ
  // ============================================================================

  /**
   * Ставит в очередь отправку уведомлений для оповещения
   */
  private async queueNotifications(alert: Alert): Promise<void> {
    const priority = this.getSeverityPriority(alert.severity);

    const messageContext = {
      id: `alert_notification_${alert.id}_${Date.now()}`,
      type: 'alert_notification',
      source: 'monitoring',
      content: JSON.stringify({ alert }),
      createdAt: new Date(),
    };

    const processor = async (message: MessageContext) => {
      if (!message.content) {
        return { success: false, handled: false, context: messageContext };
      }

      try {
        const parsedData: unknown = JSON.parse(message.content);
        if (!isAlertNotificationData(parsedData)) {
          this.logService.warn('Invalid alert notification data structure', {
            content: message.content,
          });
          return { success: false, handled: false, context: messageContext };
        }

        await this.sendNotifications(parsedData.alert);
        return { success: true, handled: true, context: messageContext };
      } catch (error) {
        this.logService.error('Error parsing alert notification data', {
          error: getErrorMessage(error),
          content: message.content,
        });
        return { success: false, handled: false, context: messageContext };
      }
    };

    await this.messageQueueService.enqueue(messageContext, processor, { priority });
  }

  /**
   * Отправляет уведомления об оповещении
   */
  async sendNotifications(alert: Alert): Promise<void> {
    return this.withErrorHandling('отправке уведомлений об оповещении', async () => {
      const notifications: Promise<boolean>[] = [];

      if (this.config.channels.slack.enabled) {
        notifications.push(this.sendSlackNotification(alert));
      }

      if (this.config.channels.pagerduty.enabled) {
        notifications.push(this.sendPagerDutyNotification(alert));
      }

      const results = await Promise.allSettled(notifications);
      const successCount = results.filter(
        result => result.status === 'fulfilled' && result.value,
      ).length;

      this.logService.log(
        `Отправлено ${successCount}/${notifications.length} уведомлений для оповещения ${alert.id}`,
      );
    });
  }

  /**
   * Отправляет уведомление в Slack (упрощенная версия)
   */
  private async sendSlackNotification(alert: Alert): Promise<boolean> {
    this.logService.debug(`Slack уведомление для оповещения ${alert.id} (заглушка)`);
    return true;
  }

  /**
   * Отправляет уведомление в PagerDuty (упрощенная версия)
   */
  private async sendPagerDutyNotification(alert: Alert): Promise<boolean> {
    this.logService.debug(`PagerDuty уведомление для оповещения ${alert.id} (заглушка)`);
    return true;
  }

  // ============================================================================
  // КОНФИГУРАЦИЯ
  // ============================================================================

  private loadConfiguration(): AlertConfiguration {
    return {
      enabled: this.configService.get<boolean>('monitoring.alerts.enabled', true),
      channels: {
        slack: {
          enabled: this.configService.get<boolean>(
            'monitoring.alerts.channels.slack.enabled',
            false,
          ),
          webhookUrl: this.configService.get<string>(
            'monitoring.alerts.channels.slack.webhookUrl',
            '',
          ),
          channel: this.configService.get<string>(
            'monitoring.alerts.channels.slack.channel',
            '#alerts',
          ),
          username: this.configService.get<string>(
            'monitoring.alerts.channels.slack.username',
            'AlertBot',
          ),
          iconEmoji: this.configService.get<string>(
            'monitoring.alerts.channels.slack.iconEmoji',
            ':warning:',
          ),
        },
        pagerduty: {
          enabled: this.configService.get<boolean>(
            'monitoring.alerts.channels.pagerduty.enabled',
            false,
          ),
          integrationKey: this.configService.get<string>(
            'monitoring.alerts.channels.pagerduty.integrationKey',
            '',
          ),
          routingKey: this.configService.get<string>(
            'monitoring.alerts.channels.pagerduty.routingKey',
            '',
          ),
        },
      },
      thresholds: {
        cpu: this.configService.get<number>('monitoring.alerts.thresholds.cpu', 80),
        memory: this.configService.get<number>('monitoring.alerts.thresholds.memory', 80),
        disk: this.configService.get<number>('monitoring.alerts.thresholds.disk', 90),
        database: this.configService.get<number>('monitoring.alerts.thresholds.database', 85),
      },
    };
  }

  getAlertConfig(): AlertConfiguration {
    return this.config;
  }

  getDisplayHelpers(): {
    getSeverityColor: (severity: AlertSeverity) => string;
    getSeverityEmoji: (severity: AlertSeverity) => string;
    getSeverityText: (severity: AlertSeverity) => string;
    getTypeText: (type: AlertType) => string;
  } {
    return {
      getSeverityColor: this.getSeverityColor.bind(this) as (severity: AlertSeverity) => string,
      getSeverityEmoji: this.getSeverityEmoji.bind(this) as (severity: AlertSeverity) => string,
      getSeverityText: this.getSeverityText.bind(this) as (severity: AlertSeverity) => string,
      getTypeText: this.getTypeText.bind(this) as (type: AlertType) => string,
    };
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.INFO:
        return '#36a64f';
      case AlertSeverity.WARNING:
        return '#ffcc00';
      case AlertSeverity.ERROR:
        return '#ff6600';
      case AlertSeverity.CRITICAL:
        return '#ff0000';
      default:
        return '#808080';
    }
  }

  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.INFO:
        return ':information_source:';
      case AlertSeverity.WARNING:
        return ':warning:';
      case AlertSeverity.ERROR:
        return ':exclamation:';
      case AlertSeverity.CRITICAL:
        return ':rotating_light:';
      default:
        return ':grey_question:';
    }
  }

  private getSeverityText(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.INFO:
        return 'Информация';
      case AlertSeverity.WARNING:
        return 'Предупреждение';
      case AlertSeverity.ERROR:
        return 'Ошибка';
      case AlertSeverity.CRITICAL:
        return 'Критическая';
      default:
        return 'Неизвестная';
    }
  }

  private getTypeText(type: AlertType): string {
    switch (type) {
      case AlertType.SYSTEM:
        return 'Система';
      case AlertType.DATABASE:
        return 'База данных';
      case AlertType.API:
        return 'API';
      case AlertType.APPLICATION:
        return 'Приложение';
      case AlertType.SECURITY:
        return 'Безопасность';
      case AlertType.PERFORMANCE:
        return 'Производительность';
      case AlertType.USER:
        return 'Пользователь';
      default:
        return 'Неизвестный';
    }
  }

  private getSeverityPriority(severity: AlertSeverity): MessagePriority {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return MessagePriority.URGENT;
      case AlertSeverity.ERROR:
        return MessagePriority.HIGH;
      case AlertSeverity.WARNING:
        return MessagePriority.NORMAL;
      case AlertSeverity.INFO:
        return MessagePriority.LOW;
      default:
        return MessagePriority.NORMAL;
    }
  }

  private setupMonitoringTasks(): void {
    this.logService.log('Задачи мониторинга настроены (заглушка)');
  }
}

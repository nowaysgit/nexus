import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Типы оповещений
 */
export enum AlertType {
  SYSTEM = 'system',
  API = 'api',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  DATABASE = 'database',
  APPLICATION = 'application',
  USER = 'user',
}

/**
 * Уровни важности оповещений
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Статусы оповещений
 */
export enum AlertStatus {
  NEW = 'new',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  IGNORED = 'ignored',
}

/**
 * Сущность оповещения (алерта)
 */
@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: AlertType,
    default: AlertType.SYSTEM,
  })
  type: AlertType;

  @Column({
    type: 'enum',
    enum: AlertSeverity,
    default: AlertSeverity.INFO,
  })
  severity: AlertSeverity;

  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.NEW,
  })
  status: AlertStatus;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ nullable: true })
  source?: string;

  @Column({ type: 'json', nullable: true })
  data?: Record<string, unknown>;

  @Column({ type: 'json', default: [] })
  notificationChannels: string[];

  @Column({ default: false })
  notified: boolean;

  @Column({ nullable: true })
  acknowledgedBy?: string;

  @Column({ nullable: true })
  resolvedBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Создает новое оповещение
   */
  static create(
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    options?: {
      source?: string;
      data?: Record<string, unknown>;
      notificationChannels?: string[];
    },
  ): Alert {
    const alert = new Alert();
    alert.type = type;
    alert.severity = severity;
    alert.title = title;
    alert.message = message;

    if (options) {
      if (options.source) {
        alert.source = options.source;
      }

      if (options.data) {
        alert.data = options.data;
      }

      if (options.notificationChannels) {
        alert.notificationChannels = options.notificationChannels;
      }
    }

    return alert;
  }

  /**
   * Отмечает оповещение как отправленное
   */
  markAsNotified(): void {
    this.notified = true;
  }

  /**
   * Подтверждает оповещение
   */
  acknowledge(user: string): void {
    this.status = AlertStatus.ACKNOWLEDGED;
    this.acknowledgedBy = user;
  }

  /**
   * Отмечает оповещение как разрешенное
   */
  resolve(user: string): void {
    this.status = AlertStatus.RESOLVED;
    this.resolvedBy = user;
  }

  /**
   * Игнорирует оповещение
   */
  ignore(): void {
    this.status = AlertStatus.IGNORED;
  }
}

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * Типы системных метрик
 */
export enum SystemMetricType {
  CPU = 'cpu',
  MEMORY = 'memory',
  DISK = 'disk',
  LOAD = 'load',
  UPTIME = 'uptime',
  NETWORK = 'network',
}

/**
 * Сущность для хранения системных метрик
 */
@Entity('system_metrics')
@Index(['metricType', 'timestamp'])
export class SystemMetric {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: SystemMetricType,
  })
  metricType: SystemMetricType;

  @Column('float')
  value: number;

  @Column({ default: '' })
  unit: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  additionalData?: Record<string, any>;

  @Column('timestamp')
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;

  /**
   * Создает новую системную метрику
   */
  static create(
    metricType: SystemMetricType,
    value: number,
    unit: string,
    timestamp: Date = new Date(),
    metadata?: Record<string, any>,
  ): SystemMetric {
    const metric = new SystemMetric();
    metric.metricType = metricType;
    metric.value = value;
    metric.unit = unit;
    metric.timestamp = timestamp;

    if (metadata) {
      metric.metadata = metadata;
    }

    return metric;
  }

  /**
   * Возвращает строковое представление метрики
   */
  toString(): string {
    return `${this.metricType}: ${this.value}${this.unit}`;
  }
}

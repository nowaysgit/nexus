import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

/**
 * Периоды агрегации метрик
 */
export enum AggregationPeriod {
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

/**
 * Сущность для хранения агрегированных метрик
 */
@Entity('metric_aggregations')
export class MetricAggregation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamp' })
  @Index()
  periodStart: Date;

  @Column({ type: 'timestamp' })
  periodEnd: Date;

  @Column({ type: 'varchar' })
  @Index()
  period: AggregationPeriod;

  @Column({ type: 'varchar' })
  @Index()
  metricType: string;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  dimension: string;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  dimensionValue: string;

  @Column({ type: 'float' })
  count: number;

  @Column({ type: 'float' })
  sum: number;

  @Column({ type: 'float' })
  min: number;

  @Column({ type: 'float' })
  max: number;

  @Column({ type: 'float' })
  avg: number;

  @Column({ type: 'float', nullable: true })
  p50: number;

  @Column({ type: 'float', nullable: true })
  p90: number;

  @Column({ type: 'float', nullable: true })
  p95: number;

  @Column({ type: 'float', nullable: true })
  p99: number;

  @Column({ type: 'jsonb', default: {} })
  tags: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  /**
   * Создает запись агрегации метрик для заданного периода
   */
  static create(
    periodStart: Date,
    periodEnd: Date,
    period: AggregationPeriod,
    metricType: string,
    stats: {
      count: number;
      sum: number;
      min: number;
      max: number;
      avg: number;
      p50?: number;
      p90?: number;
      p95?: number;
      p99?: number;
    },
    options?: {
      dimension?: string;
      dimensionValue?: string;
      tags?: Record<string, string>;
      metadata?: Record<string, any>;
    },
  ): MetricAggregation {
    const aggregation = new MetricAggregation();
    aggregation.periodStart = periodStart;
    aggregation.periodEnd = periodEnd;
    aggregation.period = period;
    aggregation.metricType = metricType;

    // Статистические данные
    aggregation.count = stats.count;
    aggregation.sum = stats.sum;
    aggregation.min = stats.min;
    aggregation.max = stats.max;
    aggregation.avg = stats.avg;
    aggregation.p50 = stats.p50 || null;
    aggregation.p90 = stats.p90 || null;
    aggregation.p95 = stats.p95 || null;
    aggregation.p99 = stats.p99 || null;

    // Дополнительные опции
    if (options) {
      aggregation.dimension = options.dimension || null;
      aggregation.dimensionValue = options.dimensionValue || null;
      aggregation.tags = options.tags || {};
      aggregation.metadata = options.metadata || {};
    }

    return aggregation;
  }
}

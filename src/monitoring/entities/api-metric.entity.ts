import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * Типы метрик API
 */
export enum ApiMetricType {
  OPENAI = 'openai',
  TELEGRAM = 'telegram',
  INTERNAL = 'internal',
  EXTERNAL = 'external',
}

/**
 * Сущность для хранения метрик API
 */
@Entity()
@Index(['metricType', 'timestamp'])
@Index(['endpoint', 'success'])
export class ApiMetric {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: ApiMetricType,
  })
  metricType: ApiMetricType;

  @Column({ nullable: true })
  endpoint?: string;

  @Column('int')
  responseTime: number;

  @Column({ nullable: true })
  statusCode?: number;

  @Column({ default: true })
  success: boolean;

  @Column({ type: 'json', nullable: true })
  requestData?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  responseData?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column('timestamp')
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;

  /**
   * Создает новую метрику API
   */
  static create(
    metricType: ApiMetricType,
    responseTime: number,
    success: boolean,
    options?: {
      endpoint?: string;
      statusCode?: number;
      requestData?: Record<string, any>;
      responseData?: Record<string, any>;
      metadata?: Record<string, any>;
      timestamp?: Date;
    },
  ): ApiMetric {
    const metric = new ApiMetric();
    metric.metricType = metricType;
    metric.responseTime = responseTime;
    metric.success = success;
    metric.timestamp = options?.timestamp || new Date();

    if (options) {
      if (options.endpoint) {
        metric.endpoint = options.endpoint;
      }

      if (options.statusCode) {
        metric.statusCode = options.statusCode;
      }

      if (options.requestData) {
        metric.requestData = options.requestData;
      }

      if (options.responseData) {
        metric.responseData = options.responseData;
      }

      if (options.metadata) {
        metric.metadata = options.metadata;
      }
    }

    return metric;
  }

  /**
   * Создает успешную метрику API
   */
  static createSuccess(
    metricType: ApiMetricType,
    responseTime: number,
    options?: {
      endpoint?: string;
      statusCode?: number;
      requestData?: Record<string, any>;
      responseData?: Record<string, any>;
      metadata?: Record<string, any>;
      timestamp?: Date;
    },
  ): ApiMetric {
    return ApiMetric.create(metricType, responseTime, true, {
      statusCode: options?.statusCode || 200,
      ...options,
    });
  }

  /**
   * Создает неуспешную метрику API
   */
  static createError(
    metricType: ApiMetricType,
    responseTime: number,
    options?: {
      endpoint?: string;
      statusCode?: number;
      requestData?: Record<string, any>;
      responseData?: Record<string, any>;
      metadata?: Record<string, any>;
      timestamp?: Date;
    },
  ): ApiMetric {
    return ApiMetric.create(metricType, responseTime, false, {
      statusCode: options?.statusCode || 500,
      ...options,
    });
  }
}

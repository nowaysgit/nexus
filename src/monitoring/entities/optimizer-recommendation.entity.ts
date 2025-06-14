import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Типы рекомендаций оптимизатора
 */
export enum RecommendationType {
  CREATE_INDEX = 'CREATE_INDEX',
  DROP_INDEX = 'DROP_INDEX',
  REINDEX = 'REINDEX',
  VACUUM = 'VACUUM',
  ANALYZE = 'ANALYZE',
  CLUSTER = 'CLUSTER',
  QUERY_OPTIMIZATION = 'QUERY_OPTIMIZATION',
  TABLE_PARTITIONING = 'TABLE_PARTITIONING',
  TABLE_COMPRESSION = 'TABLE_COMPRESSION',
  SCHEMA_OPTIMIZATION = 'SCHEMA_OPTIMIZATION',
}

/**
 * Статус рекомендации
 */
export enum RecommendationStatus {
  PENDING = 'PENDING',
  APPLIED = 'APPLIED',
  IGNORED = 'IGNORED',
  FAILED = 'FAILED',
  SCHEDULED = 'SCHEDULED',
}

/**
 * Приоритет рекомендации
 */
export enum RecommendationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Представляет рекомендацию оптимизатора базы данных
 */
@Entity('optimizer_recommendations')
export class OptimizerRecommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: RecommendationType,
  })
  type: RecommendationType;

  @Column({
    type: 'enum',
    enum: RecommendationPriority,
    default: RecommendationPriority.MEDIUM,
  })
  priority: RecommendationPriority;

  @Column({
    type: 'enum',
    enum: RecommendationStatus,
    default: RecommendationStatus.PENDING,
  })
  status: RecommendationStatus;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text' })
  sql: string;

  @Column({ type: 'text', nullable: true })
  rollbackSql: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  objectName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  objectType: string;

  @Column({ type: 'float', default: 0 })
  estimatedImprovementPercent: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  appliedAt: Date;

  /**
   * Создает новую рекомендацию оптимизатора
   */
  static create(params: {
    type: RecommendationType;
    title: string;
    description: string;
    sql: string;
    rollbackSql?: string;
    priority?: RecommendationPriority;
    objectName?: string;
    objectType?: string;
    estimatedImprovementPercent?: number;
    metadata?: Record<string, any>;
  }): OptimizerRecommendation {
    const recommendation = new OptimizerRecommendation();
    recommendation.type = params.type;
    recommendation.title = params.title;
    recommendation.description = params.description;
    recommendation.sql = params.sql;
    recommendation.rollbackSql = params.rollbackSql;
    recommendation.priority = params.priority || RecommendationPriority.MEDIUM;
    recommendation.objectName = params.objectName;
    recommendation.objectType = params.objectType;
    recommendation.estimatedImprovementPercent = params.estimatedImprovementPercent || 0;
    recommendation.metadata = params.metadata;
    recommendation.status = RecommendationStatus.PENDING;
    return recommendation;
  }

  /**
   * Отмечает рекомендацию как примененную
   */
  markAsApplied(): void {
    this.status = RecommendationStatus.APPLIED;
    this.appliedAt = new Date();
  }

  /**
   * Отмечает рекомендацию как проигнорированную
   */
  markAsIgnored(): void {
    this.status = RecommendationStatus.IGNORED;
  }

  /**
   * Отмечает рекомендацию как неудачную
   */
  markAsFailed(): void {
    this.status = RecommendationStatus.FAILED;
  }

  /**
   * Отмечает рекомендацию как запланированную
   */
  markAsScheduled(): void {
    this.status = RecommendationStatus.SCHEDULED;
  }
}

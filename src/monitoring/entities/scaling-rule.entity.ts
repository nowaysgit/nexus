import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entity для правил масштабирования
 */
@Entity('scaling_rules')
export class ScalingRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'enum', enum: ['cpu', 'memory', 'instances', 'cache'] })
  resourceType!: 'cpu' | 'memory' | 'instances' | 'cache';

  @Column({
    type: 'enum',
    enum: ['cpu', 'memory', 'api_latency', 'api_errors', 'cache_hit_rate', 'health_score'],
  })
  metricType!: 'cpu' | 'memory' | 'api_latency' | 'api_errors' | 'cache_hit_rate' | 'health_score';

  @Column({ type: 'enum', enum: ['gt', 'lt', 'gte', 'lte', 'eq'] })
  condition!: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  threshold!: number;

  @Column({ type: 'enum', enum: ['up', 'down'] })
  scaleAction!: 'up' | 'down';

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  scaleAmount!: number;

  @Column({ type: 'enum', enum: ['percent', 'absolute'] })
  scaleUnit!: 'percent' | 'absolute';

  @Column({ type: 'int' })
  cooldown!: number;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastTriggered!: Date;

  @Column({ type: 'text' })
  metricQuery!: string;

  @Column({ type: 'varchar', length: 255 })
  serviceName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  namespace!: string;

  @Column({ type: 'int' })
  minReplicas!: number;

  @Column({ type: 'int' })
  maxReplicas!: number;

  @Column({ type: 'int' })
  scalingAmount!: number;

  @Column({ type: 'int' })
  cooldownPeriodMinutes!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

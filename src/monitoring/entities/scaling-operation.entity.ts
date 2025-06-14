import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entity для операций масштабирования
 */
@Entity('scaling_operations')
export class ScalingOperation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  serviceName!: string;

  @Column({ type: 'varchar', length: 255, default: 'default' })
  namespace!: string;

  @Column({ type: 'int' })
  initialReplicas!: number;

  @Column({ type: 'int' })
  targetReplicas!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  metricValue!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  threshold!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  condition!: string;

  @Column({ type: 'timestamp' })
  timestamp!: Date;

  @Column({ type: 'enum', enum: ['pending', 'completed', 'failed'], default: 'pending' })
  status!: 'pending' | 'completed' | 'failed';

  @Column({ type: 'text', nullable: true })
  message!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

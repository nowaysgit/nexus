import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Character } from './character.entity';

export enum NeedType {
  COMMUNICATION = 'communication',
  ENTERTAINMENT = 'entertainment',
  SELF_REALIZATION = 'self_realization',
  ATTENTION = 'attention',
  AFFECTION = 'affection',
  RESPECT = 'respect',
}

export enum NeedPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('needs')
export class Need {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: NeedType })
  type: NeedType;

  @Column({ type: 'int', default: 100 })
  value: number;

  @Column({ type: 'enum', enum: NeedPriority, default: NeedPriority.LOW })
  priority: NeedPriority;

  @Column({ type: 'timestamp', nullable: true })
  lastSatisfied: Date;

  @ManyToOne(() => Character, character => character.needs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'characterId' })
  character: Character;

  @Column()
  characterId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

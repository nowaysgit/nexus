import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Character } from '../../character/entities/character.entity';

export enum EventType {
  RELATIONSHIP_CHANGE = 'relationship_change',
  CRISIS = 'crisis',
  RECONCILIATION = 'reconciliation',
  PERSONAL_CHANGE = 'personal_change',
  LIFE_EVENT = 'life_event',
}

export enum EventStatus {
  PENDING = 'pending',
  TRIGGERED = 'triggered',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
}

@Entity('story_events')
export class StoryEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: EventType })
  type: EventType;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.PENDING })
  status: EventStatus;

  @Column({ type: 'jsonb' })
  triggers: {
    affectionLevel?: number;
    trustLevel?: number;
    daysPassed?: number;
    messageCount?: number;
    specificUserMessage?: string;
    probability?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  effects: {
    affectionChange?: number;
    trustChange?: number;
    relationshipStageChange?: string;
    needsChanges?: { [key: string]: number };
    personalityChanges?: { [key: string]: number };
  };

  @Column({ type: 'jsonb', nullable: true })
  dialogOptions: string[];

  @ManyToOne(() => Character, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'characterId' })
  character: Character;

  @Column()
  characterId: number;

  @Column({ type: 'timestamp', nullable: true })
  triggeredAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

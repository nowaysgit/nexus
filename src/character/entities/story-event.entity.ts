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
  RELATIONSHIP_MILESTONE = 'relationship_milestone',
  CRISIS = 'crisis',
  RECONCILIATION = 'reconciliation',
  PERSONAL_CHANGE = 'personal_change',
  CHARACTER_DEVELOPMENT = 'character_development',
  LIFE_EVENT = 'life_event',
  SPECIAL_OCCASION = 'special_occasion',
}

export enum EventStatus {
  PENDING = 'pending',
  TRIGGERED = 'triggered',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
}

export interface StoryEventEffect {
  affectionChange?: number;
  trustChange?: number;
  relationshipStageChange?: string;
  needsChanges?: { [key: string]: number };
  personalityChanges?: { [key: string]: number };
}

export interface StoryEventTrigger {
  affectionLevel?: number;
  trustLevel?: number;
  daysPassed?: number;
  messageCount?: number;
  specificUserMessage?: string;
  probability?: number;
  relationshipStage?: string;
  characterDevelopmentStage?: string;
  date?: string;
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
  triggers: StoryEventTrigger;

  @Column({ type: 'jsonb', nullable: true })
  effects: StoryEventEffect;

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

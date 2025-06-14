import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Character } from './character.entity';

export enum TransformationType {
  WORLDVIEW_SHIFT = 'worldview_shift',
  PERSONALITY_CHANGE = 'personality_change',
  EMOTIONAL_MATURITY = 'emotional_maturity',
  BEHAVIOR_PATTERN_CHANGE = 'behavior_pattern_change',
  RELATIONSHIP_DYNAMIC_CHANGE = 'relationship_dynamic_change',
  EXISTENTIAL_AWARENESS = 'existential_awareness',
  VALUE_SYSTEM_EVOLUTION = 'value_system_evolution',
}

export enum MilestoneStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  ACHIEVED = 'achieved',
  MODIFIED = 'modified',
  CANCELLED = 'cancelled',
}

export interface TransformationDetails {
  currentState: Record<string, unknown>;
  targetState: Record<string, unknown>;
  progressIndicators: string[];
  prerequisiteEvents: number[];
  transitionMethod: 'gradual' | 'event_triggered' | 'crisis_catalyzed';
}

export interface CausalConnection {
  previousEventId?: number;
  triggeringConditions: string[];
  consequenceEvents: number[];
  timelineConstraints: {
    minimumDaysBefore?: number;
    maximumDaysBefore?: number;
    mustOccurAfter?: Date;
    mustOccurBefore?: Date;
  };
}

@Entity('story_plans')
export class StoryPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'jsonb' })
  overallArc: {
    startingState: Record<string, unknown>;
    endingState: Record<string, unknown>;
    majorThemes: string[];
    evolutionDirection: string;
  };

  @Column({ type: 'jsonb' })
  retrospectivePlanning: {
    preExistingTraits: Record<string, unknown>;
    formativeEvents: Array<{
      description: string;
      timeframe: string;
      impact: Record<string, unknown>;
    }>;
    characterHistory: string;
    pastInfluences: string[];
  };

  @OneToMany(() => StoryMilestone, milestone => milestone.storyPlan, { cascade: true })
  milestones: StoryMilestone[];

  @ManyToOne(() => Character, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'characterId' })
  character: Character;

  @Column()
  characterId: number;

  @Column({ type: 'jsonb' })
  adaptabilitySettings: {
    coreEventsRigidity: number; // 1-10
    detailsFlexibility: number; // 1-10
    userInfluenceWeight: number; // 1-10
    emergentEventTolerance: number; // 1-10
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('story_milestones')
export class StoryMilestone {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: TransformationType })
  transformationType: TransformationType;

  @Column({ type: 'enum', enum: MilestoneStatus, default: MilestoneStatus.PLANNED })
  status: MilestoneStatus;

  @Column({ type: 'int' })
  plannedMonth: number; // 1-12

  @Column({ type: 'int' })
  plannedDay: number; // относительный день от начала

  @Column({ type: 'jsonb' })
  transformationDetails: TransformationDetails;

  @Column({ type: 'jsonb' })
  causalConnections: CausalConnection;

  @Column({ type: 'int', default: 5 })
  rigidityLevel: number; // 1-10, где 10 = абсолютно жесткий каркас

  @Column({ type: 'boolean', default: false })
  isKeyMilestone: boolean; // ключевая веха трансформации

  @ManyToOne(() => Character, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'characterId' })
  character: Character;

  @Column()
  characterId: number;

  @ManyToOne(() => StoryPlan, plan => plan.milestones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storyPlanId' })
  storyPlan: StoryPlan;

  @Column()
  storyPlanId: number;

  @Column({ type: 'timestamp', nullable: true })
  achievedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  actualResults: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

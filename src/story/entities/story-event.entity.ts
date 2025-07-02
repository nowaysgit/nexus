import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { CharacterStoryProgress } from './character-story-progress.entity';

export enum StoryEventType {
  RELATIONSHIP = 'relationship', // События, связанные с отношениями
  PERSONAL_GROWTH = 'personal_growth', // Личностный рост персонажа
  WORLD_EVENT = 'world_event', // Внешние события мира
  USER_INTERACTION = 'user_interaction', // Прямое взаимодействие с пользователем
}

// JSON-структура для триггеров
export interface IStoryEventTrigger {
  relationshipStage?: { min?: number; max?: number };
  needValue?: { need: string; min?: number; max?: number };
  specificKeyword?: string[];
  // ... другие возможные триггеры
}

// JSON-структура для эффектов
export interface IStoryEventEffect {
  personalityChange?: {
    addTrait?: string[];
    removeTrait?: string[];
  };
  needChange?: { need: string; value: number }[];
  relationshipChange?: number;
  // ... другие возможные эффекты
}

@Entity('story_events')
export class StoryEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: StoryEventType,
    default: StoryEventType.USER_INTERACTION,
  })
  eventType: StoryEventType;

  @Column({ type: 'jsonb', default: {} })
  triggers: IStoryEventTrigger;

  @Column({ type: 'jsonb', default: {} })
  effects: IStoryEventEffect;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isRepeatable: boolean;

  @OneToMany(() => CharacterStoryProgress, progress => progress.storyEvent)
  characterProgress: CharacterStoryProgress[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

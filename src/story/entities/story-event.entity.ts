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
  EMOTIONAL = 'emotional', // Эмоциональные события
  NEED_FULFILLMENT = 'need_fulfillment', // События удовлетворения потребностей
}

// Расширенная JSON-структура для триггеров
export interface IStoryEventTrigger {
  relationshipStage?: { min?: number; max?: number };
  needValue?: { need: string; min?: number; max?: number };
  specificKeyword?: string[];
  timeSinceLastInteraction?: number; // в минутах
  conversationLength?: number; // количество сообщений в текущем диалоге
  emotionalState?: {
    required?: string[]; // требуемые эмоциональные состояния пользователя
    excluded?: string[]; // исключенные эмоциональные состояния
  };
  trustLevel?: { min?: number; max?: number };
  affectionLevel?: { min?: number; max?: number };
  energyLevel?: { min?: number; max?: number };
  timeOfDay?: string[]; // время суток ['morning', 'afternoon', 'evening', 'night']
  dayOfWeek?: string[]; // дни недели
  characterArchetype?: string[]; // архетипы персонажей
  userBehaviorPattern?: string; // паттерн поведения пользователя
}

// Расширенная JSON-структура для эффектов
export interface IStoryEventEffect {
  personalityChange?: {
    addTrait?: string[];
    removeTrait?: string[];
    modifyTrait?: { trait: string; intensity: number }[];
  };
  needChange?: { need: string; value: number }[];
  relationshipChange?: number;
  affectionChange?: number;
  energyChange?: number;
  relationshipStageChange?: number; // изменение на количество уровней
  addMemory?: string; // текст важного воспоминания
  triggerAction?: {
    type: string;
    parameters?: Record<string, any>;
  };
  scheduleEvent?: {
    eventId: string;
    delayMinutes: number;
  };
  modifyBehavior?: {
    temporaryTraits?: string[];
    duration?: number; // в минутах
  };
  sendMessage?: {
    text: string;
    delay?: number; // задержка в секундах
  };
  unlockFeature?: string[]; // разблокировка новых возможностей
  grantReward?: {
    type: string;
    amount: number;
  };
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

  @Column({ default: 1 })
  priority: number; // приоритет события (чем больше, тем выше)

  @Column({ nullable: true })
  cooldownMinutes: number; // время охлаждения между активациями

  @Column({ type: 'jsonb', nullable: true })
  conditions: Record<string, any>; // дополнительные условия

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // метаданные события

  @OneToMany(() => CharacterStoryProgress, progress => progress.storyEvent)
  characterProgress: CharacterStoryProgress[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

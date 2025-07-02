import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from 'typeorm';
import { Character } from '../../character/entities/character.entity';
import { StoryEvent } from './story-event.entity';

@Entity('character_story_progress')
export class CharacterStoryProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Character, character => character.storyProgress, {
    onDelete: 'CASCADE',
  })
  character: Character;

  @ManyToOne(() => StoryEvent, event => event.characterProgress, {
    onDelete: 'CASCADE',
  })
  storyEvent: StoryEvent;

  @CreateDateColumn()
  completedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  eventData: Record<string, any>;
}

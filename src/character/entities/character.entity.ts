import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  RelationId,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Dialog } from '../../dialog/entities/dialog.entity';
import { Need } from './need.entity';
import { CharacterMemory } from './character-memory.entity';
import { Action } from './action.entity';
import { CharacterMotivation } from './character-motivation.entity';
import {
  PsychologicalProfile,
  PreferencesSystem,
  IdealPartnerProfile,
} from '../interfaces/character-persona.interface';
import { CharacterArchetype } from '../enums/character-archetype.enum';
import { CharacterStoryProgress } from '../../story/entities/character-story-progress.entity';

export enum CharacterGender {
  FEMALE = 'female',
  MALE = 'male',
  OTHER = 'other',
}

export enum RelationshipStage {
  ACQUAINTANCE = 'acquaintance',
  FRIENDSHIP = 'friendship',
  ROMANCE = 'romance',
  CRISIS = 'crisis',
  RECONCILIATION = 'reconciliation',
  COMMITMENT = 'commitment',
}

export interface PersonalityData {
  traits: string[];
  hobbies: string[];
  fears: string[];
  values: string[];
  musicTaste: string[];
  strengths: string[];
  weaknesses: string[];
}

@Entity('characters')
@Index(['name'])
@Index(['archetype'])
export class Character {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  /**
   * Полное имя персонажа (имя и фамилия)
   */
  @Column({ nullable: true })
  fullName: string;

  @Column()
  age: number;

  /**
   * Пол персонажа
   */
  @Column({
    type: 'varchar',
    length: 50,
    default: CharacterGender.FEMALE,
  })
  gender: CharacterGender;

  @Column({ type: 'varchar', length: 50 })
  archetype: CharacterArchetype;

  @Column({ type: 'text' })
  biography: string;

  @Column({ type: 'text' })
  appearance: string;

  /**
   * Данные о личности персонажа в структурированном виде
   */
  @Column({ type: 'json' })
  personality: PersonalityData;

  /**
   * Детализированный психологический профиль согласно ТЗ ПЕРСОНА
   */
  @Column({ type: 'json', nullable: true })
  psychologicalProfile: PsychologicalProfile;

  /**
   * Система предпочтений персонажа согласно ТЗ ПЕРСОНА
   */
  @Column({ type: 'json', nullable: true })
  preferences: PreferencesSystem;

  /**
   * Психологический портрет идеального партнера согласно ТЗ ПЕРСОНА
   */
  @Column({ type: 'json', nullable: true })
  idealPartner: IdealPartnerProfile;

  @Column({ type: 'json', nullable: true })
  knowledgeAreas: string[];

  @Column({
    type: 'varchar',
    length: 50,
    default: RelationshipStage.ACQUAINTANCE,
  })
  relationshipStage: RelationshipStage;

  @Column({ type: 'varchar', nullable: true })
  developmentStage: string;

  @Column({ type: 'int', default: 50 })
  affection: number;

  @Column({ type: 'int', default: 50 })
  trust: number;

  @Column({ type: 'int', default: 100 })
  energy: number;

  @Column({ default: false })
  isActive: boolean;

  @Column({ default: false })
  isArchived: boolean;

  @ManyToOne(() => User, user => user.characters)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  @RelationId((character: Character) => character.user)
  userId: string;

  @OneToMany(() => Need, need => need.character, {
    cascade: true,
    eager: true,
  })
  needs: Need[];

  @OneToMany(() => Dialog, dialog => dialog.character)
  dialogs: Dialog[];

  @OneToMany(() => CharacterMemory, memory => memory.character)
  memories: CharacterMemory[];

  @OneToMany(() => Action, action => action.character)
  actions: Action[];

  @OneToMany(() => CharacterMotivation, motivation => motivation.character, {
    cascade: true,
  })
  motivations: CharacterMotivation[];

  @OneToMany(() => CharacterStoryProgress, progress => progress.character)
  storyProgress: CharacterStoryProgress[];

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastInteraction: Date;
}

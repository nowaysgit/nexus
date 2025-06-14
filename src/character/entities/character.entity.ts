import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Dialog } from '../../dialog/entities/dialog.entity';
import { Need } from './need.entity';
import { CharacterMemory } from './character-memory.entity';

export enum CharacterArchetype {
  GENTLE = 'gentle',
  FEMME_FATALE = 'femme_fatale',
  INTELLECTUAL = 'intellectual',
  ADVENTUROUS = 'adventurous',
  MYSTERIOUS = 'mysterious',
  NURTURING = 'nurturing',
  REBEL = 'rebel',
  ROMANTIC = 'romantic',
}

export enum RelationshipStage {
  ACQUAINTANCE = 'acquaintance',
  FRIENDSHIP = 'friendship',
  ROMANCE = 'romance',
  CRISIS = 'crisis',
  RECONCILIATION = 'reconciliation',
  COMMITMENT = 'commitment',
}

@Entity('characters')
export class Character {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  age: number;

  @Column({ type: 'enum', enum: CharacterArchetype })
  archetype: CharacterArchetype;

  @Column({ type: 'text' })
  biography: string;

  @Column({ type: 'text' })
  appearance: string;

  @Column({ type: 'jsonb' })
  personality: {
    traits: string[];
    hobbies: string[];
    fears: string[];
    values: string[];
    musicTaste: string[];
    strengths: string[];
    weaknesses: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  knowledgeAreas: string[];

  @Column({
    type: 'enum',
    enum: RelationshipStage,
    default: RelationshipStage.ACQUAINTANCE,
  })
  relationshipStage: RelationshipStage;

  @Column({ type: 'int', default: 50 })
  affection: number;

  @Column({ type: 'int', default: 50 })
  trust: number;

  @Column({ type: 'int', default: 100 })
  energy: number;

  @ManyToOne(() => User, user => user.characters)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @OneToMany(() => Need, need => need.character, {
    cascade: true,
    eager: true,
  })
  needs: Need[];

  @OneToMany(() => Dialog, dialog => dialog.character)
  dialogs: Dialog[];

  @OneToMany(() => CharacterMemory, memory => memory.character)
  memories: CharacterMemory[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastInteraction: Date;
}

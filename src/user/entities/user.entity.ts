import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Character } from '../../character/entities/character.entity';
import { Dialog } from '../../dialog/entities/dialog.entity';
import { PsychologicalTest } from './psychological-test.entity';
import { AccessKey } from './access-key.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  telegramId: number;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ default: 'ru' })
  language: string;

  @Column({ default: false })
  isAdmin: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  hasCompletedTest: boolean;

  @Column({ type: 'jsonb', nullable: true })
  preferences: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  communicationStyle: Record<string, number>;

  @OneToMany(() => Character, character => character.user)
  characters: Character[];

  @OneToMany(() => Dialog, dialog => dialog.user)
  dialogs: Dialog[];

  @OneToMany(() => PsychologicalTest, test => test.user)
  psychologicalTests: PsychologicalTest[];

  @OneToMany(() => AccessKey, key => key.activatedByUser)
  accessKeys: AccessKey[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  lastActivity: Date;
}

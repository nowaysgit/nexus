import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Character } from '../../character/entities/character.entity';
import { Dialog } from '../../dialog/entities/dialog.entity';
import { PsychologicalTest } from './psychological-test.entity';
import { AccessKey } from './access-key.entity';

@Entity('users')
@Index(['telegramId'])
@Index(['username'])
@Index(['email'])
@Index(['isAdmin'])
@Index(['isActive'])
@Index(['lastActivity'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  telegramId: string;

  @Column({ unique: true, nullable: true })
  username: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  @Column({ type: 'simple-array', default: () => "'user'" })
  roles: string[];

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

  @Column({ default: false })
  hasActivatedKey: boolean;

  @Column({ default: 0 })
  messagesCount: number;

  @Column({ nullable: true, type: 'datetime' })
  testCompletedAt: Date;

  @Column({ type: 'json', nullable: true })
  preferences: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  communicationStyle: Record<string, number>;

  @OneToMany(() => Character, character => character.user)
  characters: Character[];

  @OneToMany(() => Dialog, dialog => dialog.user)
  dialogs: Dialog[];

  @OneToMany(() => PsychologicalTest, test => test.user)
  psychologicalTests: PsychologicalTest[];

  @OneToMany(() => AccessKey, key => key.user)
  accessKeys: AccessKey[];

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @Column({ nullable: true, type: 'datetime' })
  lastActivity: Date;
}

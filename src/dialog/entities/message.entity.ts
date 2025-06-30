import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Dialog } from './dialog.entity';
import { User } from '../../user/entities/user.entity';
import { Character } from '../../character/entities/character.entity';

@Entity('messages')
@Index(['dialogId'])
@Index(['userId'])
@Index(['characterId'])
@Index(['isFromUser'])
@Index(['createdAt'])
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  dialogId: number;

  @ManyToOne(() => Dialog, dialog => dialog.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dialogId' })
  dialog: Dialog;

  @Column({ nullable: true })
  userId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  characterId: number;

  @ManyToOne(() => Character, { nullable: true })
  @JoinColumn({ name: 'characterId' })
  character: Character;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: true })
  isFromUser: boolean;

  @Column({ nullable: true })
  replyToMessageId?: number;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;
}

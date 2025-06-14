import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Dialog } from './dialog.entity';

@Entity()
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  dialogId: number;

  @ManyToOne(() => Dialog, dialog => dialog.messages)
  @JoinColumn({ name: 'dialogId' })
  dialog: Dialog;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: true })
  isFromUser: boolean;

  @Column({ nullable: true })
  replyToMessageId?: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}

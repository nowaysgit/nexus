import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Message } from './message.entity';

@Entity()
export class Dialog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  telegramId: string;

  @Column()
  characterId: number;

  @CreateDateColumn()
  startedAt: Date;

  @UpdateDateColumn()
  lastMessageAt: Date;

  @OneToMany(() => Message, message => message.dialog)
  messages: Message[];
}

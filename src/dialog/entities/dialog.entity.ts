import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Message } from './message.entity';
import { Character } from '../../character/entities/character.entity';
import { User } from '../../user/entities/user.entity';

@Entity('dialogs')
@Index(['userId'])
@Index(['characterId'])
@Index(['telegramId'])
@Index(['isActive'])
@Index(['lastMessageAt'])
export class Dialog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  telegramId: string;

  @Column()
  characterId: number;

  @ManyToOne(() => Character, character => character.dialogs)
  @JoinColumn({ name: 'characterId' })
  character: Character;

  @Column()
  userId: number;

  @ManyToOne(() => User, user => user.dialogs)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  title: string;

  @CreateDateColumn()
  startedAt: Date;

  @UpdateDateColumn()
  lastMessageAt: Date;

  @Column({ default: false })
  isActive: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  lastInteractionDate: Date;

  @OneToMany(() => Message, message => message.dialog, { cascade: true })
  messages: Message[];
}

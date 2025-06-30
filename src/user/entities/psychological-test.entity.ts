import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum PersonalityType {
  ANALYTICAL = 'analytical',
  EMOTIONAL = 'emotional',
  SOCIAL = 'social',
  CREATIVE = 'creative',
  PRACTICAL = 'practical',
  CONFIDENT = 'confident',
  RESERVED = 'reserved',
}

@Entity('psychological_tests')
export class PsychologicalTest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: string;

  @ManyToOne(() => User, user => user.psychologicalTests)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'json' })
  answers: Record<number, number>;

  @Column({ type: 'json' })
  scores: Record<string, number>;

  @Column({ type: 'varchar', length: 50 })
  personalityType: PersonalityType;

  @Column({ type: 'text', nullable: true })
  additionalNotes: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}

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

  @Column({ type: 'jsonb' })
  answers: Record<number, number>;

  @Column({ type: 'jsonb' })
  scores: Record<string, number>;

  @Column({ type: 'enum', enum: PersonalityType })
  personalityType: PersonalityType;

  @Column({ type: 'text', nullable: true })
  additionalNotes: string;

  @CreateDateColumn()
  createdAt: Date;
}

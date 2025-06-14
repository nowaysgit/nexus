import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Character } from './character.entity';
import { MemoryType } from '../interfaces/memory-type.enum';

// Расширенная шкала важности памяти
export type MemoryImportance = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

@Entity('character_memories')
export class CharacterMemory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: MemoryType,
    default: MemoryType.CONVERSATION,
  })
  type: MemoryType;

  @Column({
    type: 'enum',
    enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    default: 5,
  })
  importance: MemoryImportance;

  @Column({ type: 'timestamp', nullable: true })
  memoryDate: Date;

  @Column({ default: 0 })
  recallCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastRecalled: Date;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Character, character => character.memories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'characterId' })
  character: Character;

  @Column()
  characterId: number;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

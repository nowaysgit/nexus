import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Character } from './character.entity';
import { MemoryType } from '../interfaces/memory.interfaces';

// Расширенная шкала важности памяти
export type MemoryImportance = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// Экспортируем константы для использования вместо цифровых значений
export const MemoryImportanceLevel = {
  LOWEST: 1 as MemoryImportance,
  VERY_LOW: 2 as MemoryImportance,
  LOW: 3 as MemoryImportance,
  BELOW_AVERAGE: 4 as MemoryImportance,
  AVERAGE: 5 as MemoryImportance,
  ABOVE_AVERAGE: 6 as MemoryImportance,
  MODERATE: 7 as MemoryImportance,
  HIGH: 8 as MemoryImportance,
  VERY_HIGH: 9 as MemoryImportance,
  HIGHEST: 10 as MemoryImportance,
};

@Entity('character_memories')
export class CharacterMemory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: MemoryType.CONVERSATION,
  })
  type: MemoryType;

  @Column({
    type: 'int',
    default: 5,
  })
  importance: MemoryImportance;

  @Column({ type: 'datetime', nullable: true })
  memoryDate: Date;

  @Column({ default: 0 })
  recallCount: number;

  @Column({ type: 'datetime', nullable: true })
  lastRecalled: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isLongTerm: boolean;

  @ManyToOne(() => Character, character => character.memories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'characterId' })
  character: Character;

  @Column()
  characterId: number;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, comment: 'Векторное представление воспоминания для семантического поиска' })
  embedding: number[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToMany(() => CharacterMemory)
  @JoinTable({
    name: 'character_memory_relations',
    joinColumn: {
      name: 'memory_id_1',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'memory_id_2',
      referencedColumnName: 'id',
    },
  })
  relatedMemories: CharacterMemory[];
}

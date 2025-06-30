import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Character } from './character.entity';
import { CharacterNeedType } from '../enums/character-need-type.enum';

/**
 * Приоритеты потребностей
 */
export enum NeedPriority {
  LOW = 1, // Низкий приоритет
  MEDIUM = 5, // Средний приоритет
  HIGH = 10, // Высокий приоритет
}

/**
 * Сущность потребности персонажа
 */
@Entity('character_needs')
export class Need {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  characterId: number;

  @ManyToOne(() => Character, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'characterId' })
  character: Character;

  @Column({
    type: 'varchar',
  })
  type: CharacterNeedType;

  @Column('float')
  currentValue: number;

  @Column('float')
  maxValue: number;

  @Column('float')
  growthRate: number;

  @Column('float')
  decayRate: number;

  @Column('int')
  priority: number;

  @Column('float')
  threshold: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  lastUpdated: Date;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  /**
   * Проверяет, достигла ли потребность порогового значения
   */
  hasReachedThreshold(): boolean {
    return this.currentValue >= this.threshold;
  }

  /**
   * Увеличивает уровень потребности
   */
  grow(hours: number = 1): void {
    if (!this.isActive) return;

    const growth = this.growthRate * hours * (this.priority / 10);
    this.currentValue = Math.min(this.maxValue, this.currentValue + growth);
    this.lastUpdated = new Date();
  }

  /**
   * Сбрасывает потребность после удовлетворения
   */
  reset(): void {
    this.currentValue = 0;
    this.lastUpdated = new Date();
  }

  /**
   * Обновляет уровень потребности
   */
  updateLevel(change: number): void {
    this.currentValue = Math.max(0, Math.min(this.maxValue, this.currentValue + change));
    this.lastUpdated = new Date();
  }
}

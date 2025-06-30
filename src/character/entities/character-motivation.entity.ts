import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Character } from './character.entity';
import { CharacterNeedType } from '../enums/character-need-type.enum';

/**
 * Статус мотивации
 */
export enum MotivationStatus {
  ACTIVE = 'active',
  FULFILLED = 'fulfilled',
  BLOCKED = 'blocked',
  EXPIRED = 'expired',
}

/**
 * Уровень интенсивности мотивации
 */
export enum MotivationIntensity {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Entity для хранения мотиваций персонажа
 * Реализует систему многофакторных параметров согласно ТЗ ВОЛЯ
 */
@Entity('character_motivations')
export class CharacterMotivation {
  @PrimaryGeneratedColumn()
  id: number;

  /** Уникальный идентификатор мотивации в рамках персонажа */
  @Column({ unique: true })
  motivationId: string;

  /** Описание мотивации */
  @Column({ type: 'text' })
  description: string;

  /** Приоритет мотивации (1-10, где 10 - максимальный) */
  @Column({ type: 'integer', default: 5 })
  priority: number;

  /** Связанная потребность */
  @Column({ type: 'varchar', length: 50 })
  relatedNeed: CharacterNeedType;

  /** Текущий статус мотивации */
  @Column({ type: 'varchar', length: 50, default: MotivationStatus.ACTIVE })
  status: MotivationStatus;

  /** Интенсивность мотивации */
  @Column({ type: 'varchar', length: 50, default: MotivationIntensity.MODERATE })
  intensity: MotivationIntensity;

  /** Пороговое значение для активации мотивации */
  @Column({ type: 'integer', default: 70 })
  thresholdValue: number;

  /** Текущее значение накопления */
  @Column({ type: 'float', default: 0 })
  currentValue: number;

  /** Скорость накопления (единиц в минуту) */
  @Column({ type: 'float', default: 1.0 })
  accumulationRate: number;

  /** Ресурсная стоимость выполнения действия по мотивации */
  @Column({ type: 'integer', default: 10 })
  resourceCost: number;

  /** Вероятность успеха выполнения действия (0-100%) */
  @Column({ type: 'integer', default: 80 })
  successProbability: number;

  /** Потенциальное вознаграждение за выполнение */
  @Column({ type: 'json', nullable: true })
  potentialReward: {
    needReduction?: number;
    emotionalBenefit?: string;
    behaviorModifier?: string;
    resourceGain?: number;
  };

  /** Механизм обратной связи - результат последнего выполнения */
  @Column({ type: 'json', nullable: true })
  feedback: {
    lastAttemptResult?: 'success' | 'failure' | 'blocked';
    lastAttemptTime?: Date;
    consecutiveFailures?: number;
    adjustmentFactor?: number;
  };

  /** Время последнего обновления значения */
  @Column({ type: 'datetime', nullable: true })
  lastUpdated: Date;

  /** Время истечения мотивации (для временных мотиваций) */
  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;

  /** Связь с персонажем */
  @ManyToOne(() => Character, character => character.motivations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'characterId' })
  character: Character;

  @Column()
  characterId: number;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  /**
   * Проверяет, активна ли мотивация
   */
  isActive(): boolean {
    return (
      this.status === MotivationStatus.ACTIVE &&
      this.currentValue >= this.thresholdValue &&
      (!this.expiresAt || this.expiresAt > new Date())
    );
  }

  /**
   * Вычисляет вес мотивации для ранжирования
   */
  calculateWeight(): number {
    const priorityWeight = this.priority / 10;
    const intensityWeight = this.getIntensityWeight();
    const valueWeight = Math.min(this.currentValue / this.thresholdValue, 1.5);

    return priorityWeight * intensityWeight * valueWeight;
  }

  /**
   * Получает числовой вес интенсивности
   */
  private getIntensityWeight(): number {
    switch (this.intensity) {
      case MotivationIntensity.LOW:
        return 0.5;
      case MotivationIntensity.MODERATE:
        return 1.0;
      case MotivationIntensity.HIGH:
        return 1.5;
      case MotivationIntensity.CRITICAL:
        return 2.0;
      default:
        return 1.0;
    }
  }

  /**
   * Обновляет обратную связь после попытки выполнения
   */
  updateFeedback(result: 'success' | 'failure' | 'blocked'): void {
    if (!this.feedback) {
      this.feedback = {};
    }

    this.feedback.lastAttemptResult = result;
    this.feedback.lastAttemptTime = new Date();

    if (result === 'failure') {
      this.feedback.consecutiveFailures = (this.feedback.consecutiveFailures || 0) + 1;
      // Корректируем параметры при последовательных неудачах
      if (this.feedback.consecutiveFailures >= 3) {
        this.feedback.adjustmentFactor = 0.8; // Снижаем вероятность успеха
        this.successProbability = Math.max(20, this.successProbability * 0.9);
      }
    } else if (result === 'success') {
      this.feedback.consecutiveFailures = 0;
      this.feedback.adjustmentFactor = 1.2; // Повышаем эффективность
      this.successProbability = Math.min(100, this.successProbability * 1.1);
    }
  }
}

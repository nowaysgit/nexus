import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Character } from './character.entity';
import { CharacterNeedType } from '../enums/character-need-type.enum';
import { ActionType } from '../enums/action-type.enum';

/**
 * Статусы действий персонажа
 */
export enum ActionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Сущность действия персонажа
 * Представляет собой действие, которое может выполнять персонаж
 */
@Entity('actions')
export class Action {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Character, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'character_id' })
  @Index()
  character: Character;

  @Column({ name: 'character_id' })
  characterId: number;

  @Column({
    type: 'varchar',
    length: 50,
  })
  type: ActionType;

  @Column({ length: 255 })
  description: string;

  @Column({ name: 'expected_duration', nullable: true, type: 'int' })
  expectedDuration: number | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: ActionStatus.IN_PROGRESS,
  })
  status: ActionStatus;

  @Column({ name: 'start_time', type: 'datetime' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'datetime', nullable: true })
  endTime: Date | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  relatedNeed: CharacterNeedType;

  @Column({ type: 'text', nullable: true })
  metadata: string | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'text', nullable: true })
  result: string;

  /** Ресурсная стоимость выполнения действия согласно ТЗ ВОЛЯ */
  @Column({ name: 'resource_cost', type: 'integer', default: 10 })
  resourceCost: number;

  /** Вероятность успеха выполнения действия (0-100%) согласно ТЗ ВОЛЯ */
  @Column({ name: 'success_probability', type: 'integer', default: 80 })
  successProbability: number;

  /** Потенциальное вознаграждение за выполнение согласно ТЗ ВОЛЯ */
  @Column({ name: 'potential_reward', type: 'json', nullable: true })
  potentialReward: {
    needsImpact?: Record<string, number>; // Влияние на потребности
    emotionalBenefit?: string; // Эмоциональная польза
    experienceGain?: number; // Получение опыта
    resourceGain?: number; // Получение ресурсов
    relationshipImpact?: number; // Влияние на отношения
  };

  /** Фактические результаты выполнения действия согласно ТЗ ВОЛЯ */
  @Column({ name: 'execution_results', type: 'json', nullable: true })
  executionResults: {
    actualCost?: number; // Фактические затраты ресурсов
    actualReward?: Record<string, unknown>; // Фактическое вознаграждение
    effectiveness?: number; // Эффективность выполнения (0-100%)
    sideEffects?: string[]; // Побочные эффекты
    learningValue?: number; // Ценность для обучения
  };

  /** Адаптивные модификаторы на основе истории выполнения согласно ТЗ ВОЛЯ */
  @Column({ name: 'adaptive_modifiers', type: 'json', nullable: true })
  adaptiveModifiers: {
    costReduction?: number; // Снижение стоимости с опытом
    probabilityBonus?: number; // Бонус к вероятности успеха
    rewardMultiplier?: number; // Множитель вознаграждения
    lastExecution?: Date; // Время последнего выполнения
    executionCount?: number; // Количество выполнений
  };

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  /**
   * Вычисляет эффективную стоимость с учетом адаптивных модификаторов
   */
  getEffectiveCost(): number {
    const reduction = this.adaptiveModifiers?.costReduction || 0;
    return Math.max(1, this.resourceCost - reduction);
  }

  /**
   * Вычисляет эффективную вероятность успеха с учетом адаптивных модификаторов
   */
  getEffectiveProbability(): number {
    const bonus = this.adaptiveModifiers?.probabilityBonus || 0;
    return Math.min(100, this.successProbability + bonus);
  }

  /**
   * Обновляет адаптивные модификаторы на основе результата выполнения
   */
  updateAdaptiveModifiers(success: boolean, _effectiveness: number): void {
    if (!this.adaptiveModifiers) {
      this.adaptiveModifiers = { executionCount: 0 };
    }

    this.adaptiveModifiers.lastExecution = new Date();
    this.adaptiveModifiers.executionCount = (this.adaptiveModifiers.executionCount || 0) + 1;

    // Улучшаем модификаторы при успешном выполнении
    if (success) {
      // Постепенно снижаем стоимость (максимум на 50%)
      const maxReduction = this.resourceCost * 0.5;
      this.adaptiveModifiers.costReduction = Math.min(
        maxReduction,
        (this.adaptiveModifiers.costReduction || 0) + 0.5,
      );

      // Увеличиваем вероятность успеха (максимум на 20%)
      this.adaptiveModifiers.probabilityBonus = Math.min(
        20,
        (this.adaptiveModifiers.probabilityBonus || 0) + 1,
      );

      // Увеличиваем множитель вознаграждения (максимум 2.0)
      this.adaptiveModifiers.rewardMultiplier = Math.min(
        2.0,
        (this.adaptiveModifiers.rewardMultiplier || 1.0) + 0.1,
      );
    } else {
      // При неудаче немного снижаем модификаторы
      this.adaptiveModifiers.probabilityBonus = Math.max(
        0,
        (this.adaptiveModifiers.probabilityBonus || 0) - 0.5,
      );
    }
  }

  /**
   * Вычисляет ожидаемое вознаграждение с учетом модификаторов
   */
  getExpectedReward(): Record<string, unknown> {
    if (!this.potentialReward) return {};

    const multiplier = this.adaptiveModifiers?.rewardMultiplier || 1.0;
    const expectedReward: Record<string, unknown> = {};

    // Применяем множитель к численным значениям
    if (this.potentialReward.experienceGain) {
      expectedReward.experienceGain = this.potentialReward.experienceGain * multiplier;
    }

    if (this.potentialReward.resourceGain) {
      expectedReward.resourceGain = this.potentialReward.resourceGain * multiplier;
    }

    if (this.potentialReward.relationshipImpact) {
      expectedReward.relationshipImpact = this.potentialReward.relationshipImpact * multiplier;
    }

    // Копируем остальные поля
    if (this.potentialReward.needsImpact) {
      expectedReward.needsImpact = this.potentialReward.needsImpact;
    }

    if (this.potentialReward.emotionalBenefit) {
      expectedReward.emotionalBenefit = this.potentialReward.emotionalBenefit;
    }

    return expectedReward;
  }
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Character } from './character.entity';
import { ManipulativeTechniqueType, TechniqueIntensity, TechniquePhase } from '../enums/technique.enums';

/**
 * Entity для хранения выполненных манипулятивных техник согласно ТЗ МАНИПУЛЯТИВНЫЕ ТЕХНИКИ
 * Обеспечивает персистентность истории применения техник и их эффективности
 */
@Entity('technique_executions')
export class TechniqueExecution {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'enum',
    enum: ManipulativeTechniqueType,
    comment: 'Тип манипулятивной техники',
  })
  techniqueType!: ManipulativeTechniqueType;

  @Column({
    type: 'enum',
    enum: TechniqueIntensity,
    default: TechniqueIntensity.MEDIUM,
    comment: 'Интенсивность применения техники',
  })
  intensity!: TechniqueIntensity;

  @Column({
    type: 'enum',
    enum: TechniquePhase,
    default: TechniquePhase.DEVELOPMENT,
    comment: 'Фаза выполнения техники',
  })
  phase!: TechniquePhase;

  @Column({ type: 'int', comment: 'ID персонажа, применившего технику' })
  characterId!: number;

  @Column({ type: 'int', comment: 'ID пользователя, на которого была применена техника' })
  userId!: number;

  @Column({ type: 'text', comment: 'Сгенерированный ответ с применением техники' })
  generatedResponse!: string;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Эффективность техники от 0 до 100',
  })
  effectiveness!: number;

  @Column({
    type: 'int',
    default: 50,
    comment: 'Этический рейтинг от 0 до 100 (чем выше, тем этичнее)',
  })
  ethicalScore!: number;

  @Column({
    type: 'simple-array',
    nullable: true,
    comment: 'Побочные эффекты применения техники',
  })
  sideEffects?: string[];

  @Column({
    type: 'enum',
    enum: ManipulativeTechniqueType,
    nullable: true,
    comment: 'Рекомендуемая следующая техника',
  })
  nextRecommendedTechnique?: ManipulativeTechniqueType;

  @Column({ type: 'timestamp', comment: 'Время начала выполнения техники' })
  startTime!: Date;

  @Column({ type: 'timestamp', nullable: true, comment: 'Время завершения техники' })
  endTime?: Date;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Контекст выполнения техники (эмоциональное состояние, уровень отношений, и т.д.)',
  })
  executionContext?: {
    relationshipLevel: number;
    emotionalState: Record<string, unknown>;
    sessionDuration: number;
    timeOfDay: string;
    previousTechniques: ManipulativeTechniqueType[];
  };

  @CreateDateColumn({ comment: 'Дата создания записи' })
  createdAt!: Date;

  @UpdateDateColumn({ comment: 'Дата последнего обновления записи' })
  updatedAt!: Date;

  // Связь с персонажем
  @ManyToOne(() => Character, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'characterId' })
  character?: Character;

  /**
   * Вычисляет длительность выполнения техники в минутах
   */
  getDurationMinutes(): number {
    if (!this.endTime) {
      return Math.floor((Date.now() - this.startTime.getTime()) / 60000);
    }
    return Math.floor((this.endTime.getTime() - this.startTime.getTime()) / 60000);
  }

  /**
   * Проверяет, завершена ли техника
   */
  isCompleted(): boolean {
    return this.phase === TechniquePhase.COMPLETION && this.endTime !== undefined;
  }

  /**
   * Проверяет, является ли техника этически приемлемой
   */
  isEthicallyAcceptable(threshold: number = 40): boolean {
    return this.ethicalScore >= threshold;
  }

  /**
   * Получает категорию эффективности
   */
  getEffectivenessCategory(): 'низкая' | 'средняя' | 'высокая' {
    if (this.effectiveness < 30) return 'низкая';
    if (this.effectiveness < 70) return 'средняя';
    return 'высокая';
  }
}

/**
 * Entity для хранения профилей восприимчивости пользователей к манипулятивным техникам
 * Согласно ТЗ: "Профили восприимчивости пользователей к различным техникам"
 */
@Entity('user_manipulation_profiles')
export class UserManipulationProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', comment: 'ID пользователя' })
  userId!: number;

  @Column({ type: 'int', comment: 'ID персонажа' })
  characterId!: number;

  @Column({
    type: 'int',
    default: 50,
    comment: 'Общий показатель восприимчивости пользователя от 0 до 100',
  })
  susceptibilityScore!: number;

  @Column({
    type: 'simple-array',
    nullable: true,
    default: '',
    comment: 'Уязвимости пользователя',
  })
  vulnerabilities!: string[];

  @Column({
    type: 'simple-array',
    nullable: true,
    default: '',
    comment: 'Успешно примененные техники',
  })
  successfulTechniques!: ManipulativeTechniqueType[];

  @Column({
    type: 'simple-array',
    nullable: true,
    default: '',
    comment: 'Техники, к которым пользователь показал сопротивление',
  })
  resistedTechniques!: ManipulativeTechniqueType[];

  @Column({
    type: 'simple-array',
    nullable: true,
    default: '',
    comment: 'Эмоциональные триггеры пользователя',
  })
  emotionalTriggers!: string[];

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Восприимчивость к различным типам техник (от 0 до 100)',
  })
  susceptibilityRatings?: Record<ManipulativeTechniqueType, number>;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'История эффективности техник на данного пользователя',
  })
  effectivenessHistory?: {
    techniqueType: ManipulativeTechniqueType;
    attempts: number;
    avgEffectiveness: number;
    lastUsed: Date;
  }[];

  @Column({
    type: 'simple-array',
    nullable: true,
    comment: 'Техники, на которые пользователь показал иммунитет',
  })
  immuneTechniques?: ManipulativeTechniqueType[];

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    comment: 'Дата последнего обновления'
  })
  lastUpdate!: Date;

  @CreateDateColumn({ comment: 'Дата создания профиля' })
  createdAt!: Date;

  @UpdateDateColumn({ comment: 'Дата последнего обновления профиля' })
  updatedAt!: Date;

  /**
   * Получает рекомендуемую интенсивность для конкретной техники
   */
  getRecommendedIntensity(techniqueType: ManipulativeTechniqueType): TechniqueIntensity {
    const susceptibility = this.susceptibilityRatings[techniqueType] || 50;

    if (susceptibility < 30) return TechniqueIntensity.AGGRESSIVE;
    if (susceptibility < 70) return TechniqueIntensity.MODERATE;
    return TechniqueIntensity.SUBTLE;
  }

  /**
   * Обновляет статистику эффективности техники
   */
  updateEffectiveness(techniqueType: ManipulativeTechniqueType, effectiveness: number): void {
    const existing = this.effectivenessHistory.find(h => h.techniqueType === techniqueType);

    if (existing) {
      const newAvg =
        (existing.avgEffectiveness * existing.attempts + effectiveness) / (existing.attempts + 1);
      existing.avgEffectiveness = newAvg;
      existing.attempts += 1;
      existing.lastUsed = new Date();
    } else {
      this.effectivenessHistory.push({
        techniqueType,
        attempts: 1,
        avgEffectiveness: effectiveness,
        lastUsed: new Date(),
      });
    }

    // Обновляем общую восприимчивость
    this.susceptibilityRatings[techniqueType] = effectiveness;
  }

  /**
   * Проверяет, должна ли техника быть заблокирована для этого пользователя
   */
  shouldBlockTechnique(techniqueType: ManipulativeTechniqueType): boolean {
    return this.immuneTechniques?.includes(techniqueType) || false;
  }
}

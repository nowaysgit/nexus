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
 * Состояния потребности
 */
export enum NeedState {
  SATISFIED = 'satisfied',
  GROWING = 'growing',
  CRITICAL = 'critical',
  FRUSTRATED = 'frustrated',
  BLOCKED = 'blocked',
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

  // === НОВЫЕ ПОЛЯ ДЛЯ МНОГОФАКТОРНОЙ МОДЕЛИ ===

  /** Индивидуальная скорость накопления (персонализированная) */
  @Column('float', { default: 1.0 })
  individualAccumulationRate: number;

  /** Динамический приоритет (может изменяться в зависимости от контекста) */
  @Column('float', { default: 1.0 })
  dynamicPriority: number;

  /** Уровень фрустрации (0-100) */
  @Column('float', { default: 0 })
  frustrationLevel: number;

  /** Время блокировки потребности */
  @Column({ type: 'datetime', nullable: true })
  blockedUntil: Date | null;

  /** Причина блокировки */
  @Column({ type: 'varchar', nullable: true })
  blockReason: string | null;

  /** Связанные потребности (JSON массив типов потребностей) */
  @Column('text', { nullable: true })
  relatedNeeds: string | null;

  /** Коэффициенты влияния на связанные потребности */
  @Column('text', { nullable: true })
  influenceCoefficients: string | null;

  /** Текущее состояние потребности */
  @Column({
    type: 'varchar',
    default: NeedState.SATISFIED,
  })
  state: NeedState;

  /** Время последней фрустрации */
  @Column({ type: 'datetime', nullable: true })
  lastFrustrationTime: Date | null;

  /** Счетчик последовательных блокировок */
  @Column('int', { default: 0 })
  consecutiveBlocksCount: number;

  /**
   * Проверяет, достигла ли потребность порогового значения
   */
  hasReachedThreshold(): boolean {
    return this.currentValue >= this.threshold;
  }

  /**
   * Проверяет, заблокирована ли потребность
   */
  isBlocked(): boolean {
    return this.blockedUntil && new Date() < this.blockedUntil;
  }

  /**
   * Проверяет, находится ли потребность в критическом состоянии
   */
  isCritical(): boolean {
    return this.currentValue >= this.threshold * 1.5 || this.frustrationLevel >= 70;
  }

  /**
   * Увеличивает уровень потребности с учетом индивидуальной скорости
   */
  grow(hours: number = 1): void {
    if (!this.isActive || this.isBlocked()) return;

    // Базовая скорость роста с учетом индивидуальных особенностей
    const effectiveGrowthRate = this.growthRate * this.individualAccumulationRate;

    // Влияние приоритета и фрустрации на скорость роста
    const priorityMultiplier = (this.priority / 10) * this.dynamicPriority;
    const frustrationMultiplier = 1 + this.frustrationLevel / 100;

    const growth = effectiveGrowthRate * hours * priorityMultiplier * frustrationMultiplier;

    this.currentValue = Math.min(this.maxValue, this.currentValue + growth);
    this.lastUpdated = new Date();

    // Обновляем состояние
    this.updateState();
  }

  /**
   * Сбрасывает потребность после удовлетворения
   */
  reset(): void {
    this.currentValue = 0;
    this.frustrationLevel = Math.max(0, this.frustrationLevel - 20); // Снижаем фрустрацию
    this.consecutiveBlocksCount = 0;
    this.lastUpdated = new Date();
    this.state = NeedState.SATISFIED;
  }

  /**
   * Обновляет уровень потребности
   */
  updateLevel(change: number): void {
    this.currentValue = Math.max(0, Math.min(this.maxValue, this.currentValue + change));
    this.lastUpdated = new Date();
    this.updateState();
  }

  /**
   * Блокирует потребность на определенное время
   */
  blockFor(hours: number, reason: string): void {
    const blockDuration = new Date();
    blockDuration.setHours(blockDuration.getHours() + hours);

    this.blockedUntil = blockDuration;
    this.blockReason = reason;
    this.consecutiveBlocksCount++;
    this.state = NeedState.BLOCKED;

    // Увеличиваем фрустрацию при блокировке
    this.increaseFrustration(10 + this.consecutiveBlocksCount * 5);
  }

  /**
   * Снимает блокировку с потребности
   */
  unblock(): void {
    this.blockedUntil = null;
    this.blockReason = null;
    this.updateState();
  }

  /**
   * Увеличивает уровень фрустрации
   */
  increaseFrustration(amount: number): void {
    this.frustrationLevel = Math.min(100, this.frustrationLevel + amount);
    this.lastFrustrationTime = new Date();

    if (this.frustrationLevel >= 70) {
      this.state = NeedState.FRUSTRATED;
    }
  }

  /**
   * Уменьшает уровень фрустрации
   */
  decreaseFrustration(amount: number): void {
    this.frustrationLevel = Math.max(0, this.frustrationLevel - amount);
    this.updateState();
  }

  /**
   * Обновляет состояние потребности на основе текущих значений
   */
  private updateState(): void {
    if (this.isBlocked()) {
      this.state = NeedState.BLOCKED;
    } else if (this.frustrationLevel >= 70) {
      this.state = NeedState.FRUSTRATED;
    } else if (this.isCritical()) {
      this.state = NeedState.CRITICAL;
    } else if (this.hasReachedThreshold()) {
      this.state = NeedState.GROWING;
    } else {
      this.state = NeedState.SATISFIED;
    }
  }

  /**
   * Получает связанные потребности
   */
  getRelatedNeeds(): CharacterNeedType[] {
    if (!this.relatedNeeds) return [];
    try {
      return JSON.parse(this.relatedNeeds);
    } catch {
      return [];
    }
  }

  /**
   * Устанавливает связанные потребности
   */
  setRelatedNeeds(needs: CharacterNeedType[]): void {
    this.relatedNeeds = JSON.stringify(needs);
  }

  /**
   * Получает коэффициенты влияния
   */
  getInfluenceCoefficients(): Partial<Record<CharacterNeedType, number>> {
    if (!this.influenceCoefficients) return {};
    try {
      const parsed = JSON.parse(this.influenceCoefficients) as Record<string, unknown>;
      const result: Partial<Record<CharacterNeedType, number>> = {};
      Object.keys(parsed).forEach(key => {
        if (Object.values(CharacterNeedType).includes(key as CharacterNeedType)) {
          const value = parsed[key];
          result[key as CharacterNeedType] = typeof value === 'number' ? value : 0;
        }
      });
      return result;
    } catch {
      return {};
    }
  }

  /**
   * Устанавливает коэффициенты влияния
   */
  setInfluenceCoefficients(coefficients: Partial<Record<CharacterNeedType, number>>): void {
    this.influenceCoefficients = JSON.stringify(coefficients);
  }

  /**
   * Рассчитывает влияние на связанные потребности
   */
  calculateInfluenceOnRelated(): Partial<Record<CharacterNeedType, number>> {
    const relatedNeeds = this.getRelatedNeeds();
    const coefficients = this.getInfluenceCoefficients();
    const influences: Partial<Record<CharacterNeedType, number>> = {};

    for (const needType of relatedNeeds) {
      const coefficient = coefficients[needType] || 0;
      // Влияние зависит от текущего уровня потребности и коэффициента
      const influence = (this.currentValue / this.maxValue) * coefficient;
      influences[needType] = influence;
    }

    return influences;
  }
}

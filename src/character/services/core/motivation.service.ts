import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CharacterMotivation,
  MotivationStatus,
  MotivationIntensity,
} from '../../entities/character-motivation.entity';
import { Character } from '../../entities/character.entity';
import { Need } from '../../entities/need.entity';
import { LogService } from '../../../logging/log.service';
import { CharacterNeedType } from '../../enums/character-need-type.enum';
import { IMotivation } from '../../interfaces/needs.interfaces';
import { BaseService } from '../../../common/base/base.service';
import { CharacterService } from './character.service';
import { NeedsService } from './needs.service';
import { CacheService } from '../../../cache/cache.service';

/**
 * Специализированный сервис для управления мотивациями персонажей
 * Реализует систему ВОЛЯ согласно ТЗ
 */
@Injectable()
export class MotivationService extends BaseService {
  constructor(
    @InjectRepository(CharacterMotivation)
    private readonly motivationRepository: Repository<CharacterMotivation>,
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(Need)
    private readonly needRepository: Repository<Need>,
    private readonly configService: ConfigService,
    logService: LogService,
    private readonly characterService: CharacterService,
    private readonly needsService: NeedsService,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(logService);
    this.logInfo('MotivationService инициализирован');
  }

  // === ОСНОВНЫЕ МЕТОДЫ УПРАВЛЕНИЯ МОТИВАЦИЯМИ ===

  /**
   * Получение всех активных мотиваций персонажа, отсортированных по приоритету
   */
  async getCharacterMotivations(characterId: number): Promise<IMotivation[]> {
    return this.withErrorHandling('получении мотиваций персонажа', async () => {
      const motivations = await this.motivationRepository.find({
        where: {
          characterId,
          status: MotivationStatus.ACTIVE,
        },
        order: { priority: 'DESC', currentValue: 'DESC' },
      });

      // Преобразуем в интерфейс IMotivation для совместимости
      return motivations.filter(m => m.isActive()).map(m => this.convertToMotivationInterface(m));
    });
  }

  /**
   * Создание новой мотивации на основе потребности
   */
  async createMotivation(
    characterId: number,
    relatedNeed: CharacterNeedType,
    description: string,
    priority: number = 5,
    options?: {
      thresholdValue?: number;
      accumulationRate?: number;
      resourceCost?: number;
      successProbability?: number;
      expiresAt?: Date;
    },
  ): Promise<CharacterMotivation> {
    return this.withErrorHandling('создании мотивации', async () => {
      const motivationId = `${relatedNeed}_${characterId}_${Date.now()}`;

      const motivation = this.motivationRepository.create({
        motivationId,
        description,
        priority,
        relatedNeed,
        characterId,
        status: MotivationStatus.ACTIVE,
        intensity: this.determineIntensity(priority),
        thresholdValue: options?.thresholdValue || 70,
        accumulationRate: options?.accumulationRate || this.getDefaultAccumulationRate(relatedNeed),
        resourceCost: options?.resourceCost || 10,
        successProbability: options?.successProbability || 80,
        expiresAt: options?.expiresAt,
        currentValue: 0,
        lastUpdated: new Date(),
      });

      const savedMotivation = await this.motivationRepository.save(motivation);
      this.logInfo(`Создана мотивация ${motivationId} для персонажа ${characterId}`);

      // Генерируем событие создания мотивации
      this.eventEmitter.emit('motivation.created', {
        characterId,
        motivationId,
        needType: relatedNeed,
        priority,
        intensity: savedMotivation.intensity,
        description,
      });

      return savedMotivation;
    });
  }

  /**
   * Обновление значения мотивации (накопление согласно скорости)
   */
  async updateMotivationValue(
    motivationId: string,
    delta: number,
  ): Promise<CharacterMotivation | null> {
    return this.withErrorHandling('обновлении значения мотивации', async () => {
      const motivation = await this.motivationRepository.findOne({
        where: { motivationId },
      });

      if (!motivation || motivation.status !== MotivationStatus.ACTIVE) {
        return null;
      }

      const oldStatus = motivation.status;
      motivation.currentValue += delta;
      motivation.lastUpdated = new Date();

      // Проверяем достижение порогового значения
      if (motivation.currentValue >= motivation.thresholdValue) {
        this.logInfo(`Мотивация ${motivationId} достигла порогового значения`);

        // Изменяем статус на выполненный
        motivation.status = MotivationStatus.FULFILLED;

        // Генерируем событие достижения порога мотивации
        this.eventEmitter.emit('motivation.threshold_reached', {
          characterId: motivation.characterId,
          motivationId,
          needType: motivation.relatedNeed,
          currentValue: motivation.currentValue,
          thresholdValue: motivation.thresholdValue,
          intensity: motivation.intensity,
        });
      }

      const updatedMotivation = await this.motivationRepository.save(motivation);

      // Генерируем событие изменения статуса, если статус изменился
      if (oldStatus !== motivation.status) {
        this.eventEmitter.emit('motivation.status.changed', {
          motivationId,
          oldStatus,
          newStatus: motivation.status,
        });
      }

      // Генерируем событие обновления мотивации
      this.eventEmitter.emit('motivation.updated', {
        characterId: motivation.characterId,
        motivationId,
        needType: motivation.relatedNeed,
        currentValue: motivation.currentValue,
        delta,
      });

      return updatedMotivation;
    });
  }

  /**
   * Выполнение действия по мотивации
   */
  async executeMotivationAction(
    motivationId: string,
    _context?: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    result: 'success' | 'failure' | 'blocked';
    reward?: Record<string, unknown>;
  }> {
    return this.withErrorHandling('выполнении действия по мотивации', async () => {
      const motivation = await this.motivationRepository.findOne({
        where: { motivationId },
      });

      if (!motivation || motivation.status !== MotivationStatus.ACTIVE) {
        return { success: false, result: 'blocked' };
      }

      // Проверяем вероятность успеха
      const success = Math.random() * 100 < motivation.successProbability;

      if (success) {
        motivation.status = MotivationStatus.FULFILLED;
        motivation.lastUpdated = new Date();
        await this.motivationRepository.save(motivation);

        return {
          success: true,
          result: 'success',
          reward: { needType: motivation.relatedNeed, value: motivation.currentValue },
        };
      } else {
        return { success: false, result: 'failure' };
      }
    });
  }

  /**
   * Генерация мотиваций на основе текущих потребностей
   */
  async generateMotivationsFromNeeds(characterId: number): Promise<CharacterMotivation[]> {
    return this.withErrorHandling('генерации мотиваций из потребностей', async () => {
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
        relations: ['needs'],
      });

      if (!character || !character.needs) {
        return [];
      }

      const newMotivations: CharacterMotivation[] = [];
      const threshold = this.configService.get<number>('character.motivation.threshold', 70);

      for (const need of character.needs) {
        if (need.currentValue >= threshold) {
          // Проверяем, нет ли уже активной мотивации для этой потребности
          const existingMotivation = await this.motivationRepository.findOne({
            where: {
              characterId,
              relatedNeed: need.type,
              status: MotivationStatus.ACTIVE,
            },
          });

          if (!existingMotivation) {
            const motivation = await this.createMotivation(
              characterId,
              need.type,
              this.generateMotivationDescription(need.type, need.currentValue),
              this.calculatePriority(need),
              {
                thresholdValue: threshold,
                accumulationRate: this.getDefaultAccumulationRate(need.type),
              },
            );

            newMotivations.push(motivation);
          }
        }
      }

      return newMotivations;
    });
  }

  // === ФОНОВЫЕ ПРОЦЕССЫ ===

  /**
   * Фоновое обновление мотиваций (каждые 5 минут)
   */
  @Cron('*/5 * * * *')
  async updateMotivationsBackground(): Promise<void> {
    try {
      const activeMotivations = await this.motivationRepository.find({
        where: { status: MotivationStatus.ACTIVE },
      });

      for (const motivation of activeMotivations) {
        const minutesSinceUpdate = Math.floor(
          (Date.now() - motivation.lastUpdated.getTime()) / (1000 * 60),
        );

        if (minutesSinceUpdate > 0) {
          const accumulation = motivation.accumulationRate * minutesSinceUpdate;
          await this.updateMotivationValue(motivation.motivationId, accumulation);
        }
      }

      this.logInfo(`Обновлено ${activeMotivations.length} мотиваций`);
    } catch (error) {
      this.logError('Ошибка при фоновом обновлении мотиваций', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Очистка устаревших мотиваций (ежедневно)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredMotivations(): Promise<void> {
    try {
      const expiredCount = await this.motivationRepository
        .createQueryBuilder()
        .update(CharacterMotivation)
        .set({ status: MotivationStatus.EXPIRED })
        .where('expiresAt IS NOT NULL AND expiresAt < :now', { now: new Date() })
        .execute();

      this.logInfo(`Помечено как истёкшие ${expiredCount.affected} мотиваций`);
    } catch (error) {
      this.logError('Ошибка при очистке устаревших мотиваций', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===

  /**
   * Преобразование Entity в интерфейс для совместимости
   */
  private convertToMotivationInterface(motivation: CharacterMotivation): IMotivation {
    return {
      id: parseInt(motivation.motivationId.split('_').pop() || '0', 10),
      characterId: motivation.characterId,
      needType: motivation.relatedNeed,
      intensity:
        motivation.intensity === MotivationIntensity.CRITICAL
          ? 90
          : motivation.intensity === MotivationIntensity.HIGH
            ? 75
            : motivation.intensity === MotivationIntensity.MODERATE
              ? 50
              : 25,
      status: motivation.status,
      createdAt: motivation.createdAt,
      priority: motivation.priority,
    };
  }

  /**
   * Определение интенсивности на основе приоритета
   */
  private determineIntensity(priority: number): MotivationIntensity {
    if (priority >= 9) return MotivationIntensity.CRITICAL;
    if (priority >= 7) return MotivationIntensity.HIGH;
    if (priority >= 4) return MotivationIntensity.MODERATE;
    return MotivationIntensity.LOW;
  }

  /**
   * Получение скорости накопления по умолчанию для типа потребности
   */
  private getDefaultAccumulationRate(needType: CharacterNeedType): number {
    const baseRates = {
      [CharacterNeedType.HUNGER]: 1.2,
      [CharacterNeedType.THIRST]: 1.5,
      [CharacterNeedType.REST]: 1.0,
      [CharacterNeedType.SECURITY]: 0.8,
      [CharacterNeedType.STABILITY]: 0.7,
      [CharacterNeedType.COMFORT]: 0.9,
      [CharacterNeedType.SOCIAL_CONNECTION]: 1.1,
      [CharacterNeedType.ATTENTION]: 2.0,
      [CharacterNeedType.ACCEPTANCE]: 1.3,
      [CharacterNeedType.BELONGING]: 1.2,
      [CharacterNeedType.COMMUNICATION]: 1.8,
      [CharacterNeedType.COMPANIONSHIP]: 1.4,
      [CharacterNeedType.INTIMACY]: 1.1,
      [CharacterNeedType.VALIDATION]: 2.5,
      [CharacterNeedType.AFFECTION]: 1.5,
      [CharacterNeedType.RESPECT]: 1.3,
      [CharacterNeedType.RECOGNITION]: 1.4,
      [CharacterNeedType.STATUS]: 1.0,
      [CharacterNeedType.POWER]: 0.9,
      [CharacterNeedType.AUTONOMY]: 1.1,
      [CharacterNeedType.COMPETENCE]: 1.2,
      [CharacterNeedType.SELF_EXPRESSION]: 1.0,
      [CharacterNeedType.CREATIVITY]: 1.1,
      [CharacterNeedType.GROWTH]: 1.2,
      [CharacterNeedType.MEANING]: 0.9,
      [CharacterNeedType.PURPOSE]: 0.8,
      [CharacterNeedType.ACHIEVEMENT]: 1.3,
      [CharacterNeedType.EXCITEMENT]: 1.7,
      [CharacterNeedType.PLEASURE]: 1.6,
      [CharacterNeedType.JOY]: 1.8,
      [CharacterNeedType.RELAXATION]: 1.4,
      [CharacterNeedType.ENTERTAINMENT]: 2.2,
      [CharacterNeedType.FUN]: 3.0,
      [CharacterNeedType.KNOWLEDGE]: 1.1,
      [CharacterNeedType.UNDERSTANDING]: 1.0,
      [CharacterNeedType.EXPLORATION]: 1.3,
      [CharacterNeedType.CURIOSITY]: 1.5,
      [CharacterNeedType.MENTAL_STIMULATION]: 1.2,
      [CharacterNeedType.FREEDOM]: 1.0,
      [CharacterNeedType.CONNECTION]: 1.5,
      [CharacterNeedType.SELF_REALIZATION]: 1.0,
      [CharacterNeedType.USER_COMMAND]: 0,
      [CharacterNeedType.USER_REQUEST]: 0,
      [CharacterNeedType.SYSTEM]: 0,
    };

    return baseRates[needType] || 1.0;
  }

  /**
   * Генерация описания мотивации на основе типа потребности
   */
  private generateMotivationDescription(needType: CharacterNeedType, value: number): string {
    const descriptions: Record<CharacterNeedType, string> = {
      [CharacterNeedType.HUNGER]: `Потребность в питании достигла ${value}%. Необходимо восполнить энергию.`,
      [CharacterNeedType.THIRST]: `Потребность в жидкости достигла ${value}%. Необходимо утолить жажду.`,
      [CharacterNeedType.REST]: `Потребность в отдыхе достигла ${value}%. Необходимо восстановить силы.`,
      [CharacterNeedType.SECURITY]: `Потребность в безопасности достигла ${value}%. Нужна стабильность и защищённость.`,
      [CharacterNeedType.STABILITY]: `Потребность в стабильности достигла ${value}%. Необходима определенность.`,
      [CharacterNeedType.COMFORT]: `Потребность в комфорте достигла ${value}%. Хочется более комфортных условий.`,
      [CharacterNeedType.SOCIAL_CONNECTION]: `Потребность в социальном взаимодействии достигла ${value}%. Хочется общения.`,
      [CharacterNeedType.ATTENTION]: `Потребность во внимании достигла ${value}%. Хочется привлечь внимание пользователя.`,
      [CharacterNeedType.ACCEPTANCE]: `Потребность в принятии достигла ${value}%. Хочется чувствовать себя принятым.`,
      [CharacterNeedType.BELONGING]: `Потребность в принадлежности достигла ${value}%. Хочется быть частью группы.`,
      [CharacterNeedType.COMMUNICATION]: `Потребность в общении достигла ${value}%. Хочется поговорить и поделиться мыслями.`,
      [CharacterNeedType.COMPANIONSHIP]: `Потребность в компании достигла ${value}%. Хочется проводить время вместе.`,
      [CharacterNeedType.INTIMACY]: `Потребность в близости достигла ${value}%. Хочется эмоциональной связи.`,
      [CharacterNeedType.VALIDATION]: `Потребность в признании достигла ${value}%. Нужно получить одобрение.`,
      [CharacterNeedType.AFFECTION]: `Потребность в привязанности достигла ${value}%. Хочется близости и тепла.`,
      [CharacterNeedType.RESPECT]: `Потребность в уважении достигла ${value}%. Нужно признание своей ценности.`,
      [CharacterNeedType.RECOGNITION]: `Потребность в признании достигла ${value}%. Хочется быть замеченным.`,
      [CharacterNeedType.STATUS]: `Потребность в статусе достигла ${value}%. Хочется повысить свое положение.`,
      [CharacterNeedType.POWER]: `Потребность во влиянии достигла ${value}%. Хочется иметь больше контроля.`,
      [CharacterNeedType.AUTONOMY]: `Потребность в автономии достигла ${value}%. Хочется больше независимости.`,
      [CharacterNeedType.COMPETENCE]: `Потребность в компетентности достигла ${value}%. Хочется проявить мастерство.`,
      [CharacterNeedType.SELF_EXPRESSION]: `Потребность в самовыражении достигла ${value}%. Хочется выразить себя.`,
      [CharacterNeedType.CREATIVITY]: `Потребность в творчестве достигла ${value}%. Хочется создать что-то новое.`,
      [CharacterNeedType.GROWTH]: `Потребность в росте достигла ${value}%. Желание учиться и развиваться.`,
      [CharacterNeedType.MEANING]: `Потребность в смысле достигла ${value}%. Хочется найти смысл в происходящем.`,
      [CharacterNeedType.PURPOSE]: `Потребность в цели достигла ${value}%. Хочется найти свое предназначение.`,
      [CharacterNeedType.ACHIEVEMENT]: `Потребность в достижении достигла ${value}%. Хочется добиться результата.`,
      [CharacterNeedType.EXCITEMENT]: `Потребность в возбуждении достигла ${value}%. Хочется острых ощущений.`,
      [CharacterNeedType.PLEASURE]: `Потребность в удовольствии достигла ${value}%. Хочется приятных переживаний.`,
      [CharacterNeedType.JOY]: `Потребность в радости достигла ${value}%. Хочется испытать счастье.`,
      [CharacterNeedType.RELAXATION]: `Потребность в расслаблении достигла ${value}%. Хочется снять напряжение.`,
      [CharacterNeedType.ENTERTAINMENT]: `Потребность в развлечениях достигла ${value}%. Нужно что-то интересное и захватывающее.`,
      [CharacterNeedType.FUN]: `Потребность в веселье достигла ${value}%. Хочется развлечься и подурачиться.`,
      [CharacterNeedType.KNOWLEDGE]: `Потребность в знаниях достигла ${value}%. Хочется узнать больше.`,
      [CharacterNeedType.UNDERSTANDING]: `Потребность в понимании достигла ${value}%. Хочется разобраться в сути.`,
      [CharacterNeedType.EXPLORATION]: `Потребность в исследовании достигла ${value}%. Хочется изучить новое.`,
      [CharacterNeedType.CURIOSITY]: `Потребность в любопытстве достигла ${value}%. Хочется удовлетворить интерес.`,
      [CharacterNeedType.MENTAL_STIMULATION]: `Потребность в умственной стимуляции достигла ${value}%. Хочется интеллектуальной активности.`,
      [CharacterNeedType.FREEDOM]: `Потребность в свободе достигла ${value}%. Хочется проявить независимость.`,
      [CharacterNeedType.CONNECTION]: `Потребность в связи достигла ${value}%. Желание углубить отношения.`,
      [CharacterNeedType.SELF_REALIZATION]: `Потребность в самореализации достигла ${value}%. Желание проявить свою индивидуальность.`,
      [CharacterNeedType.USER_COMMAND]: 'Выполнение команды пользователя',
      [CharacterNeedType.USER_REQUEST]: 'Выполнение запроса пользователя',
      [CharacterNeedType.SYSTEM]: 'Системная потребность',
    };

    return descriptions[needType] || `Потребность ${needType} требует внимания.`;
  }

  /**
   * Вычисление приоритета мотивации на основе потребности
   */
  private calculatePriority(need: Need): number {
    // Базовый приоритет зависит от значения потребности и её важности
    const valueWeight = Math.min(need.currentValue / 100, 1.0);
    // priority является числом, где высокое значение означает высокий приоритет
    const priorityWeight = need.priority >= 8 ? 1.5 : need.priority >= 5 ? 1.0 : 0.7;

    return Math.round(valueWeight * priorityWeight * 10);
  }
}

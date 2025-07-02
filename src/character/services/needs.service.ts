import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LogService } from '../../logging/log.service';
import { Need } from '../entities/need.entity';
import { Character } from '../entities/character.entity';
import { INeedsService, INeed, INeedUpdate } from '../interfaces/needs.interfaces';
import { CharacterNeedType } from '../enums/character-need-type.enum';
import { BaseService } from '../../common/base/base.service';
import { MessageQueueService, MessagePriority } from '../../message-queue/message-queue.service';
import { MessageContext } from '../../common/interfaces/message-processor.interface';

@Injectable()
export class NeedsService extends BaseService implements INeedsService {
  constructor(
    @InjectRepository(Need)
    private readonly needRepository: Repository<Need>,
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    private readonly eventEmitter: EventEmitter2,
    logService: LogService,
    private readonly messageQueueService: MessageQueueService,
  ) {
    super(logService);
  }

  /**
   * Обновляет потребность персонажа
   */
  async updateNeed(characterId: number, update: INeedUpdate): Promise<INeed> {
    try {
      const need = await this.needRepository.findOne({
        where: { characterId, type: update.type, isActive: true },
      });

      if (!need) {
        this.logWarning(`Потребность ${update.type} не найдена для персонажа ${characterId}`);
        throw new Error(`Потребность ${update.type} не найдена для персонажа ${characterId}`);
      }

      const oldValue = need.currentValue;
      need.updateLevel(update.change);

      await this.needRepository.save(need);

      // Генерируем событие изменения потребности
      this.eventEmitter.emit('need.updated', {
        characterId,
        needType: update.type,
        oldValue,
        newValue: need.currentValue,
        change: update.change,
        reason: update.reason,
      });

      this.logInfo(
        `Обновлена потребность ${update.type} для персонажа ${characterId}: ${oldValue} -> ${need.currentValue} (${update.reason})`,
      );

      return this.mapToInterface(need);
    } catch (error) {
      this.logError('Ошибка обновления потребности', {
        characterId,
        update,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Получает все потребности персонажа
   */
  async getNeedsByCharacter(characterId: number): Promise<INeed[]> {
    try {
      const needs = await this.needRepository.find({
        where: { characterId },
        order: { priority: 'DESC', currentValue: 'DESC' },
      });

      return needs.map(need => this.mapToInterface(need));
    } catch (error) {
      this.logError('Ошибка получения потребностей персонажа', {
        characterId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Получает активные потребности персонажа
   */
  async getActiveNeeds(characterId: number): Promise<INeed[]> {
    try {
      const needs = await this.needRepository.find({
        where: { characterId, isActive: true },
        order: { priority: 'DESC', currentValue: 'DESC' },
      });

      return needs.map(need => this.mapToInterface(need));
    } catch (error) {
      this.logError('Ошибка получения активных потребностей', {
        characterId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Обрабатывает рост потребностей с учетом многофакторной модели
   */
  async processNeedsGrowth(characterId: number): Promise<INeed[]> {
    try {
      const needs = await this.needRepository.find({
        where: { characterId, isActive: true },
      });

      const updatedNeeds: INeed[] = [];

      for (const need of needs) {
        const hoursSinceUpdate = this.getHoursSinceUpdate(need.lastUpdated);

        if (hoursSinceUpdate > 0) {
          const oldValue = need.currentValue;
          const oldState = need.state;

          // Используем обновленный метод роста с учетом индивидуальных факторов
          need.grow(hoursSinceUpdate);

          await this.needRepository.save(need);
          updatedNeeds.push(this.mapToInterface(need));

          // Обрабатываем влияние на связанные потребности при изменении состояния
          if (oldState !== need.state) {
            await this.processRelatedNeedsInfluence(characterId, need);
          }

          // Генерируем событие роста потребности
          this.eventEmitter.emit('need.grown', {
            characterId,
            needType: need.type,
            oldValue,
            newValue: need.currentValue,
            growth: need.currentValue - oldValue,
            hours: hoursSinceUpdate,
            frustrationLevel: need.frustrationLevel,
            state: need.state,
            dynamicPriority: need.dynamicPriority,
          });

          // Проверяем достижение порога
          if (need.hasReachedThreshold() && oldValue < need.threshold) {
            this.eventEmitter.emit('need.threshold_reached', {
              characterId,
              needType: need.type,
              currentValue: need.currentValue,
              threshold: need.threshold,
              frustrationLevel: need.frustrationLevel,
            });
          }

          // Проверяем критическое состояние
          if (need.isCritical() && !need.isCritical.call({ ...need, currentValue: oldValue })) {
            this.eventEmitter.emit('need.critical_state', {
              characterId,
              needType: need.type,
              currentValue: need.currentValue,
              frustrationLevel: need.frustrationLevel,
            });
          }
        }
      }

      if (updatedNeeds.length > 0) {
        this.logInfo(
          `Обработан рост потребностей для персонажа ${characterId}: ${updatedNeeds.length} потребностей обновлено`,
        );
      }

      return updatedNeeds;
    } catch (error) {
      this.logError('Ошибка обработки роста потребностей', {
        characterId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Сбрасывает потребность после удовлетворения
   */
  async resetNeed(characterId: number, needType: CharacterNeedType): Promise<void> {
    try {
      const need = await this.needRepository.findOne({
        where: { characterId, type: needType, isActive: true },
      });

      if (!need) {
        this.logWarning(`Потребность ${needType} не найдена для сброса у персонажа ${characterId}`);
        return;
      }

      const oldValue = need.currentValue;
      need.reset();

      await this.needRepository.save(need);

      // Генерируем событие сброса потребности
      this.eventEmitter.emit('need.reset', {
        characterId,
        needType,
        oldValue,
        newValue: need.currentValue,
      });

      this.logInfo(
        `Сброшена потребность ${needType} для персонажа ${characterId}: ${oldValue} -> 0`,
      );
    } catch (error) {
      this.logError('Ошибка сброса потребности', {
        characterId,
        needType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Создает базовые потребности для нового персонажа
   */
  async createDefaultNeeds(characterId: number): Promise<INeed[]> {
    try {
      const character = await this.characterRepository.findOne({
        where: { id: characterId },
      });

      if (!character) {
        throw new Error(`Персонаж с ID ${characterId} не найден`);
      }

      const defaultNeeds = this.getDefaultNeedsConfig();
      const createdNeeds: Need[] = [];

      for (const config of defaultNeeds) {
        const need = this.needRepository.create({
          characterId,
          type: config.type,
          currentValue: 0,
          maxValue: 100,
          threshold: config.threshold,
          priority: config.priority,
          growthRate: config.growthRate,
          decayRate: 0.5,
          isActive: true,
        });

        const savedNeed = await this.needRepository.save(need);
        createdNeeds.push(savedNeed);
      }

      this.logInfo(
        `Созданы базовые потребности для персонажа ${characterId}: ${createdNeeds.length} потребностей`,
      );

      return createdNeeds.map(need => this.mapToInterface(need));
    } catch (error) {
      this.logError('Ошибка создания базовых потребностей', {
        characterId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Фоновая обработка потребностей всех персонажей
   * Метод запускается по расписанию и ставит в очередь задачи
   * для обработки потребностей каждого активного персонажа.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processAllCharactersNeeds(): Promise<void> {
    this.logInfo('Запуск фоновой обработки потребностей для всех персонажей');
    try {
      const characters = await this.characterRepository.find({
        where: { isActive: true },
        select: ['id'], // Выбираем только ID для оптимизации
      });

      this.logInfo(`Найдено ${characters.length} активных персонажей для обработки.`);

      for (const character of characters) {
        const messageContext: MessageContext = {
          id: `needs-growth-${character.id}-${Date.now()}`,
          type: 'PROCESS_NEEDS_GROWTH',
          source: 'SYSTEM_CRON',
          metadata: {
            characterId: character.id,
            description: `Обработка роста потребностей для персонажа ${character.id}`,
          },
        };

        // Ставим задачу в очередь и не ждем ее выполнения
        this.messageQueueService
          .enqueue(
            messageContext,
            async (context: MessageContext) => {
              // Безопасно извлекаем characterId
              const charId = context.metadata?.characterId;
              if (typeof charId !== 'number') {
                const error = new Error(
                  `Неверный или отсутствующий characterId в метаданных задачи: ${String(charId)}`,
                );
                this.logError(error.message, { context });
                return { success: false, handled: true, context, error };
              }

              try {
                this.logInfo(`Начало обработки потребностей из очереди для персонажа: ${charId}`);
                const updatedNeeds = await this.processNeedsGrowth(charId);
                this.logInfo(
                  `Завершение обработки потребностей из очереди для персонажа: ${charId}`,
                );
                return {
                  success: true,
                  handled: true,
                  context,
                  result: {
                    message: `Потребности для персонажа ${charId} успешно обработаны. Обновлено: ${updatedNeeds.length}`,
                  },
                };
              } catch (error) {
                const typedError = error instanceof Error ? error : new Error(String(error));
                this.logError(
                  `Ошибка при обработке потребностей из очереди для персонажа: ${charId}`,
                  { error: typedError },
                );
                return {
                  success: false,
                  handled: true,
                  context,
                  error: typedError,
                };
              }
            },
            { priority: MessagePriority.LOW }, // Используем корректный enum и значение
          )
          .catch(error => {
            this.logError(`Ошибка при постановке задачи в очередь для персонажа ${character.id}`, {
              error,
            });
          });
      }

      this.logInfo('Все задачи по обработке потребностей поставлены в очередь.');
    } catch (error) {
      this.logError('Критическая ошибка при запуске фоновой обработки потребностей', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Возвращает конфигурацию базовых потребностей
   */
  private getDefaultNeedsConfig() {
    return [
      { type: CharacterNeedType.COMMUNICATION, threshold: 70, priority: 8, growthRate: 2.0 },
      { type: CharacterNeedType.ATTENTION, threshold: 60, priority: 7, growthRate: 1.5 },
      { type: CharacterNeedType.VALIDATION, threshold: 80, priority: 6, growthRate: 1.0 },
      { type: CharacterNeedType.GROWTH, threshold: 50, priority: 5, growthRate: 0.8 },
      { type: CharacterNeedType.REST, threshold: 40, priority: 4, growthRate: 0.5 },
      { type: CharacterNeedType.ENTERTAINMENT, threshold: 60, priority: 6, growthRate: 1.2 },
      { type: CharacterNeedType.AFFECTION, threshold: 75, priority: 7, growthRate: 1.3 },
      { type: CharacterNeedType.FREEDOM, threshold: 65, priority: 5, growthRate: 0.7 },
      { type: CharacterNeedType.SELF_REALIZATION, threshold: 55, priority: 6, growthRate: 0.9 },
      { type: CharacterNeedType.CONNECTION, threshold: 70, priority: 8, growthRate: 1.8 },
    ];
  }

  /**
   * Вычисляет количество часов с последнего обновления
   */
  private getHoursSinceUpdate(lastUpdated: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - lastUpdated.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60));
  }

  /**
   * Преобразует сущность в интерфейс
   */
  private mapToInterface(need: Need): INeed {
    return {
      id: need.id,
      characterId: need.characterId,
      type: need.type,
      currentValue: Number(need.currentValue),
      threshold: Number(need.threshold),
      priority: need.priority,
      growthRate: Number(need.growthRate),
      decayRate: Number(need.decayRate),
      maxValue: Number(need.maxValue),
      lastUpdated: need.lastUpdated,
      isActive: need.isActive,
      dynamicPriority: need.dynamicPriority,
    };
  }

  /**
   * Получает все потребности персонажа (алиас для getNeedsByCharacter)
   */
  async getNeeds(characterId: number): Promise<INeed[]> {
    return this.getNeedsByCharacter(characterId);
  }

  /**
   * Получает потребность персонажа по типу
   */
  async getNeedsByType(characterId: number, type: CharacterNeedType): Promise<INeed> {
    try {
      const need = await this.needRepository.findOne({
        where: { characterId, type, isActive: true },
      });

      if (!need) {
        throw new Error(`Потребность типа ${type} не найдена для персонажа ${characterId}`);
      }

      return this.mapToInterface(need);
    } catch (error) {
      this.logError('Ошибка получения потребности по типу', {
        characterId,
        type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Рассчитывает рост потребностей и возвращает обновленные потребности
   */
  async calculateNeedsGrowth(characterId: number): Promise<INeed[]> {
    return this.processNeedsGrowth(characterId);
  }

  /**
   * Получает неудовлетворенные потребности персонажа
   */
  async getUnfulfilledNeeds(characterId: number): Promise<INeed[]> {
    try {
      const needs = await this.needRepository.find({
        where: { characterId, isActive: true },
      });

      const unfulfilled = needs.filter(need => need.currentValue >= need.threshold);
      return unfulfilled.map(need => this.mapToInterface(need));
    } catch (error) {
      this.logError('Ошибка получения неудовлетворенных потребностей', {
        characterId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Устанавливает индивидуальную скорость накопления для потребности
   */
  async setIndividualAccumulationRate(
    characterId: number,
    needType: CharacterNeedType,
    rate: number,
  ): Promise<void> {
    try {
      const need = await this.needRepository.findOne({
        where: { characterId, type: needType, isActive: true },
      });

      if (!need) {
        this.logWarning(`Потребность ${needType} не найдена для персонажа ${characterId}`);
        return;
      }

      need.individualAccumulationRate = Math.max(0.1, Math.min(5.0, rate)); // Ограничиваем диапазон
      await this.needRepository.save(need);

      this.logInfo(
        `Установлена индивидуальная скорость накопления ${rate} для потребности ${needType} персонажа ${characterId}`,
      );
    } catch (error) {
      this.logError('Ошибка установки индивидуальной скорости накопления', {
        characterId,
        needType,
        rate,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Обновляет динамический приоритет потребности на основе контекста
   */
  async updateDynamicPriority(
    characterId: number,
    needType: CharacterNeedType,
    contextFactor: number,
  ): Promise<void> {
    try {
      const need = await this.needRepository.findOne({
        where: { characterId, type: needType, isActive: true },
      });

      if (!need) {
        this.logWarning(`Потребность ${needType} не найдена для персонажа ${characterId}`);
        return;
      }

      // Динамический приоритет учитывает контекстные факторы
      need.dynamicPriority = Math.max(0.1, Math.min(3.0, contextFactor));
      await this.needRepository.save(need);

      this.eventEmitter.emit('need.priority_updated', {
        characterId,
        needType,
        newPriority: need.dynamicPriority,
        contextFactor,
      });

      this.logInfo(
        `Обновлен динамический приоритет для потребности ${needType} персонажа ${characterId}: ${need.dynamicPriority}`,
      );
    } catch (error) {
      this.logError('Ошибка обновления динамического приоритета', {
        characterId,
        needType,
        contextFactor,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Блокирует потребность на определенное время
   */
  async blockNeed(
    characterId: number,
    needType: CharacterNeedType,
    hours: number,
    reason: string,
  ): Promise<void> {
    try {
      const need = await this.needRepository.findOne({
        where: { characterId, type: needType, isActive: true },
      });

      if (!need) {
        this.logWarning(`Потребность ${needType} не найдена для персонажа ${characterId}`);
        return;
      }

      need.blockFor(hours, reason);
      await this.needRepository.save(need);

      // Обрабатываем влияние на связанные потребности
      await this.processRelatedNeedsInfluence(characterId, need);

      this.eventEmitter.emit('need.blocked', {
        characterId,
        needType,
        hours,
        reason,
        frustrationLevel: need.frustrationLevel,
      });

      this.logInfo(
        `Заблокирована потребность ${needType} для персонажа ${characterId} на ${hours} часов. Причина: ${reason}`,
      );
    } catch (error) {
      this.logError('Ошибка блокировки потребности', {
        characterId,
        needType,
        hours,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Разблокирует потребность
   */
  async unblockNeed(characterId: number, needType: CharacterNeedType): Promise<void> {
    try {
      const need = await this.needRepository.findOne({
        where: { characterId, type: needType, isActive: true },
      });

      if (!need) {
        this.logWarning(`Потребность ${needType} не найдена для персонажа ${characterId}`);
        return;
      }

      need.unblock();
      await this.needRepository.save(need);

      this.eventEmitter.emit('need.unblocked', {
        characterId,
        needType,
      });

      this.logInfo(`Разблокирована потребность ${needType} для персонажа ${characterId}`);
    } catch (error) {
      this.logError('Ошибка разблокировки потребности', {
        characterId,
        needType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Настраивает связи между потребностями
   */
  async setupNeedRelations(
    characterId: number,
    needType: CharacterNeedType,
    relatedNeeds: CharacterNeedType[],
    influenceCoefficients: Partial<Record<CharacterNeedType, number>>,
  ): Promise<void> {
    try {
      const need = await this.needRepository.findOne({
        where: { characterId, type: needType, isActive: true },
      });

      if (!need) {
        this.logWarning(`Потребность ${needType} не найдена для персонажа ${characterId}`);
        return;
      }

      need.setRelatedNeeds(relatedNeeds);
      need.setInfluenceCoefficients(influenceCoefficients);
      await this.needRepository.save(need);

      this.logInfo(
        `Настроены связи для потребности ${needType} персонажа ${characterId}: ${relatedNeeds.length} связанных потребностей`,
      );
    } catch (error) {
      this.logError('Ошибка настройки связей между потребностями', {
        characterId,
        needType,
        relatedNeeds,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Получает потребности в критическом состоянии
   */
  async getCriticalNeeds(characterId: number): Promise<INeed[]> {
    try {
      const needs = await this.needRepository.find({
        where: { characterId, isActive: true },
      });

      const criticalNeeds = needs.filter(need => need.isCritical());
      return criticalNeeds.map(need => this.mapToInterface(need));
    } catch (error) {
      this.logError('Ошибка получения критических потребностей', {
        characterId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Получает заблокированные потребности
   */
  async getBlockedNeeds(characterId: number): Promise<INeed[]> {
    try {
      const needs = await this.needRepository.find({
        where: { characterId, isActive: true },
      });

      const blockedNeeds = needs.filter(need => need.isBlocked());
      return blockedNeeds.map(need => this.mapToInterface(need));
    } catch (error) {
      this.logError('Ошибка получения заблокированных потребностей', {
        characterId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Обрабатывает влияние на связанные потребности
   */
  private async processRelatedNeedsInfluence(characterId: number, sourceNeed: Need): Promise<void> {
    try {
      const relatedNeedTypes = sourceNeed.getRelatedNeeds();
      if (relatedNeedTypes.length === 0) return;

      const influence = sourceNeed.calculateInfluenceOnRelated();

      for (const relatedType of relatedNeedTypes) {
        const coefficient = influence[relatedType];
        if (!coefficient) continue;

        const relatedNeed = await this.needRepository.findOne({
          where: { characterId, type: relatedType, isActive: true },
        });

        if (relatedNeed) {
          // Влияние зависит от состояния источника и коэффициента
          let influenceAmount = 0;

          if (sourceNeed.state === 'blocked' || sourceNeed.state === 'frustrated') {
            // Негативное влияние при блокировке или фрустрации
            influenceAmount = coefficient * sourceNeed.frustrationLevel * 0.1;
            relatedNeed.increaseFrustration(influenceAmount);
          } else if (sourceNeed.state === 'satisfied') {
            // Позитивное влияние при удовлетворении
            influenceAmount = coefficient * 10;
            relatedNeed.decreaseFrustration(Math.abs(influenceAmount));
          }

          await this.needRepository.save(relatedNeed);

          this.eventEmitter.emit('need.influenced', {
            characterId,
            sourceNeedType: sourceNeed.type,
            targetNeedType: relatedType,
            influence: influenceAmount,
            coefficient,
          });
        }
      }
    } catch (error) {
      this.logError('Ошибка обработки влияния на связанные потребности', {
        characterId,
        sourceNeedType: sourceNeed.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

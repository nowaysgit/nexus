import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LogService } from '../../logging/log.service';
import { Need } from '../entities/need.entity';
import { Character } from '../entities/character.entity';
import {
  INeedsService,
  INeed,
  INeedUpdate,
} from '../interfaces/needs.interfaces';
import { CharacterNeedType } from '../enums/character-need-type.enum';

@Injectable()
export class NeedsService implements INeedsService {
  constructor(
    @InjectRepository(Need)
    private readonly needRepository: Repository<Need>,
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    private readonly eventEmitter: EventEmitter2,
    private readonly logService: LogService,
  ) {}

  /**
   * Обновляет потребность персонажа
   */
  async updateNeed(characterId: number, update: INeedUpdate): Promise<INeed> {
    try {
      const need = await this.needRepository.findOne({
        where: { characterId, type: update.type, isActive: true },
      });

      if (!need) {
        this.logService.warn(`Потребность ${update.type} не найдена для персонажа ${characterId}`);
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

      this.logService.log(
        `Обновлена потребность ${update.type} для персонажа ${characterId}: ${oldValue} -> ${need.currentValue} (${update.reason})`,
      );
      
      return this.mapToInterface(need);
    } catch (error) {
      this.logService.error('Ошибка обновления потребности', {
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
      this.logService.error('Ошибка получения потребностей персонажа', {
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
      this.logService.error('Ошибка получения активных потребностей', {
        characterId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Обрабатывает рост потребностей (фоновая задача)
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
          need.grow(hoursSinceUpdate);

          await this.needRepository.save(need);
          updatedNeeds.push(this.mapToInterface(need));

          // Генерируем событие роста потребности
          this.eventEmitter.emit('need.grown', {
            characterId,
            needType: need.type,
            oldValue,
            newValue: need.currentValue,
            growth: need.currentValue - oldValue,
            hours: hoursSinceUpdate,
          });

          // Проверяем достижение порога
          if (need.hasReachedThreshold() && oldValue < need.threshold) {
            this.eventEmitter.emit('need.threshold_reached', {
              characterId,
              needType: need.type,
              currentValue: need.currentValue,
              threshold: need.threshold,
            });
          }
        }
      }

      if (updatedNeeds.length > 0) {
        this.logService.log(
          `Обработан рост потребностей для персонажа ${characterId}: ${updatedNeeds.length} потребностей обновлено`,
        );
      }

      return updatedNeeds;
    } catch (error) {
      this.logService.error('Ошибка обработки роста потребностей', {
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
        this.logService.warn(
          `Потребность ${needType} не найдена для сброса у персонажа ${characterId}`,
        );
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

      this.logService.log(
        `Сброшена потребность ${needType} для персонажа ${characterId}: ${oldValue} -> 0`,
      );
    } catch (error) {
      this.logService.error('Ошибка сброса потребности', {
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

      this.logService.log(
        `Созданы базовые потребности для персонажа ${characterId}: ${createdNeeds.length} потребностей`,
      );

      return createdNeeds.map(need => this.mapToInterface(need));
    } catch (error) {
      this.logService.error('Ошибка создания базовых потребностей', {
        characterId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Фоновая задача для автоматического обновления потребностей всех персонажей
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processAllCharactersNeeds(): Promise<void> {
    try {
      const characters = await this.characterRepository.find({
        where: { isArchived: false },
        select: ['id'],
      });

      this.logService.log(
        `Запуск фонового обновления потребностей для ${characters.length} персонажей`,
      );

      for (const character of characters) {
        try {
          await this.processNeedsGrowth(character.id);
        } catch (error) {
          this.logService.error(`Ошибка обновления потребностей для персонажа ${character.id}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.logService.log('Завершено фоновое обновление потребностей всех персонажей');
    } catch (error) {
      this.logService.error('Ошибка фонового обновления потребностей', {
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
      { type: CharacterNeedType.GROWTH, threshold: 40, priority: 4, growthRate: 0.5 },
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
      this.logService.error('Ошибка получения потребности по типу', {
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
      this.logService.error('Ошибка получения неудовлетворенных потребностей', {
        characterId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

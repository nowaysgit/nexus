import { Injectable } from '@nestjs/common';
import { Repository, FindOperator } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TechniqueExecution } from '../entities/manipulation-technique.entity';

/**
 * Репозиторий для работы с исполнениями техник манипуляции
 */
@Injectable()
export class TechniqueExecutionRepository {
  constructor(
    @InjectRepository(TechniqueExecution)
    private readonly repository: Repository<TechniqueExecution>,
  ) {}

  /**
   * Найти исполнение техники по ID
   * @param id ID исполнения техники
   * @returns Исполнение техники или null, если не найдено
   */
  async findById(id: string | number): Promise<TechniqueExecution | null> {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.repository.findOne({ where: { id: numericId as number | FindOperator<number> } });
  }

  /**
   * Найти все исполнения техник для персонажа
   * @param characterId ID персонажа
   * @returns Массив исполнений техник
   */
  async findByCharacterId(characterId: string | number): Promise<TechniqueExecution[]> {
    const numericCharacterId =
      typeof characterId === 'string' ? parseInt(characterId, 10) : characterId;
    return this.repository.find({
      where: { characterId: numericCharacterId as number | FindOperator<number> },
    });
  }

  /**
   * Найти все исполнения техник для пользователя
   * @param userId ID пользователя
   * @returns Массив исполнений техник
   */
  async findByUserId(userId: string | number): Promise<TechniqueExecution[]> {
    const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    return this.repository.find({
      where: { userId: numericUserId as number | FindOperator<number> },
    });
  }

  /**
   * Сохранить исполнение техники
   * @param execution Исполнение техники для сохранения
   * @returns Сохраненное исполнение техники
   */
  async save(execution: Partial<TechniqueExecution>): Promise<TechniqueExecution> {
    return this.repository.save(execution);
  }

  /**
   * Обновить исполнение техники
   * @param id ID исполнения техники
   * @param data Данные для обновления
   * @returns Результат обновления
   */
  async update(
    id: string | number,
    data: Partial<TechniqueExecution>,
  ): Promise<{ affected?: number }> {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.repository.update(numericId, data);
  }

  /**
   * Удалить исполнение техники
   * @param id ID исполнения техники
   * @returns Результат удаления
   */
  async delete(id: string | number): Promise<{ affected?: number }> {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.repository.delete(numericId);
  }
}

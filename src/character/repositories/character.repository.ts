import { Injectable } from '@nestjs/common';
import { Repository, FindOperator } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Character } from '../entities/character.entity';

/**
 * Репозиторий для работы с персонажами
 */
@Injectable()
export class CharacterRepository {
  constructor(
    @InjectRepository(Character)
    private readonly repository: Repository<Character>,
  ) {}

  /**
   * Найти персонажа по ID
   * @param id ID персонажа
   * @returns Персонаж или null, если не найден
   */
  async findById(id: string | number): Promise<Character | null> {
    // Преобразуем ID в числовой формат для совместимости с FindOperator<number>
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.repository.findOne({ where: { id: numericId as number | FindOperator<number> } });
  }

  /**
   * Найти всех персонажей пользователя
   * @param userId ID пользователя
   * @returns Массив персонажей
   */
  async findByUserId(userId: string | number): Promise<Character[]> {
    // Преобразуем userId в строковый формат для совместимости с Character.userId: string
    const stringUserId = typeof userId === 'number' ? String(userId) : userId;
    return this.repository.find({
      where: { userId: stringUserId as string | FindOperator<string> },
    });
  }

  /**
   * Сохранить персонажа
   * @param character Персонаж для сохранения
   * @returns Сохраненный персонаж
   */
  async save(character: Partial<Character>): Promise<Character> {
    return this.repository.save(character);
  }

  /**
   * Обновить персонажа
   * @param id ID персонажа
   * @param data Данные для обновления
   * @returns Результат обновления
   */
  async update(id: string | number, data: Partial<Character>): Promise<{ affected?: number }> {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.repository.update(numericId, data);
  }

  /**
   * Удалить персонажа
   * @param id ID персонажа
   * @returns Результат удаления
   */
  async delete(id: string | number): Promise<{ affected?: number }> {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.repository.delete(numericId);
  }
}

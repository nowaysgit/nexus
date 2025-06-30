import { Injectable } from '@nestjs/common';
import { Repository, FindOperator } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserManipulationProfile } from '../entities/manipulation-technique.entity';

/**
 * Репозиторий для работы с профилями манипуляции пользователей
 */
@Injectable()
export class UserManipulationProfileRepository {
  constructor(
    @InjectRepository(UserManipulationProfile)
    private readonly repository: Repository<UserManipulationProfile>,
  ) {}

  /**
   * Найти профиль манипуляции по ID
   * @param id ID профиля манипуляции
   * @returns Профиль манипуляции или null, если не найден
   */
  async findById(id: string | number): Promise<UserManipulationProfile | null> {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.repository.findOne({ where: { id: numericId as number | FindOperator<number> } });
  }

  /**
   * Найти профиль манипуляции по ID пользователя и ID персонажа
   * @param userId ID пользователя
   * @param characterId ID персонажа
   * @returns Профиль манипуляции или null, если не найден
   */
  async findByUserAndCharacter(
    userId: string | number,
    characterId: string | number,
  ): Promise<UserManipulationProfile | null> {
    const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const numericCharacterId =
      typeof characterId === 'string' ? parseInt(characterId, 10) : characterId;

    return this.repository.findOne({
      where: {
        userId: numericUserId as number | FindOperator<number>,
        characterId: numericCharacterId as number | FindOperator<number>,
      },
    });
  }

  /**
   * Найти все профили манипуляции для персонажа
   * @param characterId ID персонажа
   * @returns Массив профилей манипуляции
   */
  async findByCharacterId(characterId: string | number): Promise<UserManipulationProfile[]> {
    const numericCharacterId =
      typeof characterId === 'string' ? parseInt(characterId, 10) : characterId;
    return this.repository.find({
      where: { characterId: numericCharacterId as number | FindOperator<number> },
    });
  }

  /**
   * Найти все профили манипуляции для пользователя
   * @param userId ID пользователя
   * @returns Массив профилей манипуляции
   */
  async findByUserId(userId: string | number): Promise<UserManipulationProfile[]> {
    const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    return this.repository.find({
      where: { userId: numericUserId as number | FindOperator<number> },
    });
  }

  /**
   * Сохранить профиль манипуляции
   * @param profile Профиль манипуляции для сохранения
   * @returns Сохраненный профиль манипуляции
   */
  async save(profile: Partial<UserManipulationProfile>): Promise<UserManipulationProfile> {
    return this.repository.save(profile);
  }

  /**
   * Обновить профиль манипуляции
   * @param id ID профиля манипуляции
   * @param data Данные для обновления
   * @returns Результат обновления
   */
  async update(
    id: string | number,
    data: Partial<UserManipulationProfile>,
  ): Promise<{ affected?: number }> {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.repository.update(numericId, data);
  }

  /**
   * Удалить профиль манипуляции
   * @param id ID профиля манипуляции
   * @returns Результат удаления
   */
  async delete(id: string | number): Promise<{ affected?: number }> {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.repository.delete(numericId);
  }
}

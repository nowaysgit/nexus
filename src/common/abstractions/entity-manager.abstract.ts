import { Repository } from 'typeorm';
import { BaseService } from '../base/base.service';
import { getErrorMessage } from '../utils/error.utils';

/**
 * Абстрактный менеджер сущностей для унификации CRUD операций
 */
export abstract class EntityManager<T extends { id: string | number }> extends BaseService {
  protected constructor(
    protected readonly repository: Repository<T>,
    protected readonly entityName: string,
    logService: any,
  ) {
    super(logService);
  }

  /**
   * Находит сущность по ID или выбрасывает ошибку "не найден"
   */
  protected async findEntityOrFail(id: string | number): Promise<T> {
    return this.withErrorHandling(`поиске ${this.entityName}`, async () => {
      const entity = await this.repository.findOne({ where: { id } as any });
      if (!entity) {
        throw new Error(`${this.entityName} с ID ${id} не найден`);
      }
      return entity;
    });
  }

  /**
   * Находит сущность по ID или возвращает null
   */
  protected async findEntityById(id: string | number): Promise<T | null> {
    return this.withErrorHandling(`поиске ${this.entityName}`, async () => {
      return await this.repository.findOne({ where: { id } as any });
    });
  }

  /**
   * Находит все сущности с опциональными условиями
   */
  protected async findEntities(conditions?: Partial<T>): Promise<T[]> {
    return this.withErrorHandling(`поиске всех ${this.entityName}`, async () => {
      if (conditions) {
        return await this.repository.find({ where: conditions as any });
      }
      return await this.repository.find();
    });
  }

  /**
   * Создает новую сущность
   */
  protected async createEntity(data: Partial<T>): Promise<T> {
    return this.withErrorHandling(`создании ${this.entityName}`, async () => {
      const entity = this.repository.create(data as any);
      const savedEntity = await this.repository.save(entity);
      return Array.isArray(savedEntity) ? savedEntity[0] : savedEntity;
    });
  }

  /**
   * Обновляет существующую сущность
   */
  protected async updateEntity(id: string | number, data: Partial<T>): Promise<T> {
    return this.withErrorHandling(`обновлении ${this.entityName}`, async () => {
      const entity = await this.findEntityOrFail(id);
      Object.assign(entity, data);
      return await this.repository.save(entity);
    });
  }

  /**
   * Удаляет сущность по ID
   */
  protected async deleteEntity(id: string | number): Promise<void> {
    return this.withErrorHandling(`удалении ${this.entityName}`, async () => {
      const entity = await this.findEntityOrFail(id);
      await this.repository.remove(entity);
    });
  }

  /**
   * Проверяет существование сущности
   */
  protected async entityExists(id: string | number): Promise<boolean> {
    return this.withErrorHandling(`проверке существования ${this.entityName}`, async () => {
      const count = await this.repository.count({ where: { id } as any });
      return count > 0;
    });
  }

  /**
   * Валидирует входные параметры
   */
  protected validateParams(params: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) {
        throw new Error(`Параметр ${key} обязателен`);
      }
      if (typeof value === 'string' && value.trim() === '') {
        throw new Error(`Параметр ${key} не может быть пустым`);
      }
    }
  }

  /**
   * Безопасно извлекает сообщение ошибки
   */
  protected getErrorMessage(error: unknown): string {
    return getErrorMessage(error);
  }

  /**
   * Логирует операцию с сущностью
   */
  protected logEntityOperation(operation: string, entityId?: string | number, details?: any): void {
    const message = entityId
      ? `${operation} ${this.entityName} с ID ${entityId}`
      : `${operation} ${this.entityName}`;

    if (details) {
      this.logInfo(message, details);
    } else {
      this.logInfo(message);
    }
  }
}

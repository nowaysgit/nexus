import { DataSource, EntityMetadata, Repository, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory хранилище для мок DataSource
 */
class MockDatabase {
  private data = new Map<string, Map<string, any>>();
  private sequences = new Map<string, number>();

  getTable(tableName: string): Map<string, any> {
    if (!this.data.has(tableName)) {
      this.data.set(tableName, new Map());
    }
    return this.data.get(tableName);
  }

  insert(tableName: string, entity: any): any {
    const table = this.getTable(tableName);
    const id = entity.id || this.generateId(tableName);
    const savedEntity = { ...entity, id };
    table.set(id, savedEntity);
    return savedEntity;
  }

  findOne(tableName: string, criteria: any): any | null {
    const table = this.getTable(tableName);
    console.log(`[MOCK FIND ONE] Table: ${tableName}, Criteria:`, criteria);
    console.log(`[MOCK FIND ONE] Table size: ${table.size}, All IDs:`, Array.from(table.keys()));

    // Поиск по ID
    if (typeof criteria === 'string' || typeof criteria === 'number') {
      const found = table.get(String(criteria)) || null;
      console.log(`[MOCK FIND ONE BY ID] Looking for ID: ${criteria}, Found:`, found);
      return found;
    }

    // Поиск по условиям
    if (criteria && typeof criteria === 'object') {
      for (const [id, entity] of table.entries()) {
        let matches = true;
        for (const [key, value] of Object.entries(criteria)) {
          if (entity[key] !== value) {
            matches = false;
            break;
          }
        }
        if (matches) {
          console.log(`[MOCK FIND ONE BY CRITERIA] Found:`, entity);
          return entity;
        }
      }
    }

    console.log(`[MOCK FIND ONE] No match found`);
    return null;
  }

  find(tableName: string, criteria?: any): any[] {
    const table = this.getTable(tableName);
    const entities = Array.from(table.values());
    console.log(`[MOCK FIND] Table: ${tableName}, Criteria:`, criteria);
    console.log(`[MOCK FIND] Table size: ${table.size}, Total entities: ${entities.length}`);

    if (!criteria) {
      console.log(`[MOCK FIND] No criteria, returning all ${entities.length} entities`);
      return entities;
    }

    // Фильтрация по условиям
    const filtered = entities.filter(entity => {
      for (const [key, value] of Object.entries(criteria)) {
        if (entity[key] !== value) {
          return false;
        }
      }
      return true;
    });

    console.log(`[MOCK FIND] Filtered result: ${filtered.length} entities`);
    return filtered;
  }

  remove(tableName: string, entity: any): any {
    const table = this.getTable(tableName);
    const id = entity.id;
    if (id && table.has(id)) {
      table.delete(id);
    }
    return entity;
  }

  clear(tableName?: string): void {
    if (tableName) {
      this.data.delete(tableName);
    } else {
      this.data.clear();
      this.sequences.clear();
    }
  }

  private generateId(tableName: string): string {
    // Для User и других сущностей с UUID
    if (tableName === 'user' || tableName === 'character') {
      return uuidv4();
    }

    // Для остальных - числовой ID
    const current = this.sequences.get(tableName) || 0;
    const nextId = current + 1;
    this.sequences.set(tableName, nextId);
    return nextId.toString();
  }
}

const mockDatabase = new MockDatabase();

/**
 * Создает мок Repository с in-memory хранилищем
 */
function createMockRepository(tableName: string): Repository<any> {
  const repository = {
    save: async (entity: any): Promise<any> => {
      if (Array.isArray(entity)) {
        return entity.map(e => mockDatabase.insert(tableName, e));
      }
      return mockDatabase.insert(tableName, entity);
    },

    findOne: async (options?: any): Promise<any> => {
      console.log(`[MOCK REPOSITORY ${tableName.toUpperCase()}] findOne called with:`, options);
      if (!options) return null;

      // Обработка разных форматов опций
      if (typeof options === 'string' || typeof options === 'number') {
        const result = mockDatabase.findOne(tableName, options);
        console.log(`[MOCK REPOSITORY ${tableName.toUpperCase()}] findOne by ID result:`, result);
        return result;
      }

      if (options.where) {
        const result = mockDatabase.findOne(tableName, options.where);
        console.log(
          `[MOCK REPOSITORY ${tableName.toUpperCase()}] findOne by where result:`,
          result,
        );
        return result;
      }

      const result = mockDatabase.findOne(tableName, options);
      console.log(
        `[MOCK REPOSITORY ${tableName.toUpperCase()}] findOne by options result:`,
        result,
      );
      return result;
    },

    find: async (options?: any): Promise<any[]> => {
      console.log(`[MOCK REPOSITORY ${tableName.toUpperCase()}] find called with:`, options);
      if (!options) {
        const result = mockDatabase.find(tableName);
        console.log(`[MOCK REPOSITORY ${tableName.toUpperCase()}] find all result:`, result);
        return result;
      }

      if (options.where) {
        const result = mockDatabase.find(tableName, options.where);
        console.log(`[MOCK REPOSITORY ${tableName.toUpperCase()}] find by where result:`, result);
        return result;
      }

      const result = mockDatabase.find(tableName, options);
      console.log(`[MOCK REPOSITORY ${tableName.toUpperCase()}] find by options result:`, result);
      return result;
    },

    findBy: async (criteria: any): Promise<any[]> => {
      return mockDatabase.find(tableName, criteria);
    },

    findOneBy: async (criteria: any): Promise<any> => {
      return mockDatabase.findOne(tableName, criteria);
    },

    remove: async (entity: any): Promise<any> => {
      if (Array.isArray(entity)) {
        return entity.map(e => mockDatabase.remove(tableName, e));
      }
      return mockDatabase.remove(tableName, entity);
    },

    create: (entityLike: any): any => {
      return { ...entityLike };
    },

    count: async (): Promise<number> => {
      return mockDatabase.find(tableName).length;
    },

    delete: async (criteria: any): Promise<any> => {
      const entities = mockDatabase.find(tableName, criteria);
      entities.forEach(entity => mockDatabase.remove(tableName, entity));
      return { affected: entities.length };
    },

    manager: {
      query: async (): Promise<any[]> => [],
      save: async (entity: any): Promise<any> => {
        return Array.isArray(entity)
          ? entity.map(e => mockDatabase.insert(tableName, e))
          : mockDatabase.insert(tableName, entity);
      },
      findOne: async (EntityClass: any, criteria: any): Promise<any> => {
        const tableName = EntityClass.name?.toLowerCase() || 'entity';
        return mockDatabase.findOne(tableName, criteria);
      },
      find: async (EntityClass: any, criteria?: any): Promise<any[]> => {
        const tableName = EntityClass.name?.toLowerCase() || 'entity';
        return mockDatabase.find(tableName, criteria);
      },
      findBy: async (EntityClass: any, criteria: any): Promise<any[]> => {
        const tableName = EntityClass.name?.toLowerCase() || 'entity';
        return mockDatabase.find(tableName, criteria);
      },
      findOneBy: async (EntityClass: any, criteria: any): Promise<any> => {
        const tableName = EntityClass.name?.toLowerCase() || 'entity';
        return mockDatabase.findOne(tableName, criteria);
      },
      remove: async (entity: any): Promise<any> => {
        return mockDatabase.remove(tableName, entity);
      },
    },

    query: async (): Promise<any[]> => [],
    metadata: {} as EntityMetadata,
  } as unknown as Repository<any>;

  return repository;
}

/**
 * Создает мок QueryRunner с in-memory операциями
 */
function createMockQueryRunner(): QueryRunner {
  return {
    connect: async (): Promise<void> => {},
    release: async (): Promise<void> => {},

    manager: {
      query: async (sql: string): Promise<any[]> => {
        // Простейшая обработка SQL запросов
        if (sql.includes('SELECT 1')) {
          return [{ '?column?': 1 }];
        }
        if (sql.includes('SELECT version()')) {
          return [{ version: 'Mock PostgreSQL 15.0' }];
        }
        return [];
      },

      save: async (entity: any): Promise<any> => {
        const tableName = entity.constructor?.name?.toLowerCase() || 'entity';
        return mockDatabase.insert(tableName, entity);
      },

      findOne: async (EntityClass: any, criteria: any): Promise<any> => {
        const tableName = EntityClass.name?.toLowerCase() || 'entity';
        return mockDatabase.findOne(tableName, criteria);
      },

      find: async (EntityClass: any, criteria?: any): Promise<any[]> => {
        const tableName = EntityClass.name?.toLowerCase() || 'entity';
        return mockDatabase.find(tableName, criteria);
      },

      findBy: async (EntityClass: any, criteria: any): Promise<any[]> => {
        const tableName = EntityClass.name?.toLowerCase() || 'entity';
        return mockDatabase.find(tableName, criteria);
      },

      findOneBy: async (EntityClass: any, criteria: any): Promise<any> => {
        const tableName = EntityClass.name?.toLowerCase() || 'entity';
        return mockDatabase.findOne(tableName, criteria);
      },

      remove: async (entity: any): Promise<any> => {
        const tableName = entity.constructor?.name?.toLowerCase() || 'entity';
        return mockDatabase.remove(tableName, entity);
      },
    },

    query: async (sql: string): Promise<any[]> => {
      // Обработка базовых SQL запросов
      if (sql.includes('SELECT 1')) {
        return [{ '?column?': 1 }];
      }
      if (sql.includes('SELECT version()')) {
        return [{ version: 'Mock PostgreSQL 15.0' }];
      }
      if (sql.includes('CREATE SCHEMA')) {
        return [];
      }
      return [];
    },

    // Добавляем недостающие свойства QueryRunner
    connection: {} as any,
    isReleased: false,
    isTransactionActive: false,
    data: {},

    startTransaction: async (): Promise<void> => {},
    commitTransaction: async (): Promise<void> => {},
    rollbackTransaction: async (): Promise<void> => {},
  } as QueryRunner;
}

/**
 * Создает улучшенный мок DataSource с in-memory хранилищем
 */
export function createEnhancedMockDataSource(): DataSource {
  const mockDataSource = {
    isInitialized: true,
    options: {
      type: 'postgres' as const,
      database: 'mock_test_db',
      schema: 'mock_schema',
    },

    createQueryRunner: (): QueryRunner => createMockQueryRunner(),

    manager: {
      query: async (sql: string): Promise<any[]> => {
        if (sql.includes('SELECT 1')) {
          return [{ '?column?': 1 }];
        }
        if (sql.includes('SELECT version()')) {
          return [{ version: 'Mock PostgreSQL 15.0' }];
        }
        return [];
      },

      save: async (entity: any): Promise<any> => {
        const tableName = entity.constructor?.name?.toLowerCase() || 'entity';
        return mockDatabase.insert(tableName, entity);
      },

      findOne: async (EntityClass: any, criteria: any): Promise<any> => {
        const tableName = EntityClass.name?.toLowerCase() || 'entity';
        return mockDatabase.findOne(tableName, criteria);
      },

      find: async (EntityClass: any, criteria?: any): Promise<any[]> => {
        const tableName = EntityClass.name?.toLowerCase() || 'entity';
        return mockDatabase.find(tableName, criteria);
      },

      findBy: async (EntityClass: any, criteria: any): Promise<any[]> => {
        const tableName = EntityClass.name?.toLowerCase() || 'entity';
        return mockDatabase.find(tableName, criteria);
      },

      findOneBy: async (EntityClass: any, criteria: any): Promise<any> => {
        const tableName = EntityClass.name?.toLowerCase() || 'entity';
        return mockDatabase.findOne(tableName, criteria);
      },

      remove: async (entity: any): Promise<any> => {
        const tableName = entity.constructor?.name?.toLowerCase() || 'entity';
        return mockDatabase.remove(tableName, entity);
      },
    },

    query: async (sql: string): Promise<any[]> => {
      if (sql.includes('SELECT 1')) {
        return [{ '?column?': 1 }];
      }
      if (sql.includes('SELECT version()')) {
        return [{ version: 'Mock PostgreSQL 15.0' }];
      }
      return [];
    },

    initialize: async (): Promise<DataSource> => {
      console.log('[MockDataSource] Инициализирован');
      return mockDataSource as DataSource;
    },

    destroy: async (): Promise<void> => {
      console.log('[MockDataSource] Закрыт');
      mockDatabase.clear();
    },

    getRepository: (entity: any): Repository<any> => {
      const tableName = (typeof entity === 'function' ? entity.name : String(entity)).toLowerCase();
      return createMockRepository(tableName);
    },

    // Метод для очистки данных в тестах
    clearDatabase: (): void => {
      mockDatabase.clear();
    },
  } as DataSource & { clearDatabase: () => void };

  return mockDataSource;
}

/**
 * Глобальный экземпляр мок DataSource
 */
export const globalMockDataSource = createEnhancedMockDataSource();

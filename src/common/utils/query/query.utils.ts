import {
  FindManyOptions,
  FindOptionsOrder,
  FindOptionsWhere,
  Repository,
  ObjectLiteral,
} from 'typeorm';

export interface OptimizedQueryOptions<T extends ObjectLiteral> {
  relations?: string[];
  select?: (keyof T)[];
  order?: FindOptionsOrder<T>;
  limit?: number;
  offset?: number;
  cache?: boolean;
  cacheKey?: string;
}

export interface OptimizedQueryResult<T> {
  data: T[];
  total?: number;
  executionTime?: number;
  fromCache?: boolean;
}

/**
 * Выполняет оптимизированный запрос к базе данных
 */
export async function executeOptimizedQuery<T extends ObjectLiteral>(
  repository: Repository<T>,
  where: FindOptionsWhere<T>,
  options: OptimizedQueryOptions<T> = {},
): Promise<OptimizedQueryResult<T>> {
  const startTime = Date.now();
  const { relations = [], select, order, limit, offset, cache = false, cacheKey } = options;

  const findOptions: FindManyOptions<T> = {
    where,
    relations,
    order,
    take: limit,
    skip: offset,
    cache,
  };

  if (select && select.length > 0) {
    findOptions.select = select;
  }

  if (cache && cacheKey) {
    findOptions.cache = {
      id: cacheKey,
      milliseconds: 60000,
    };
  }

  let total: number | undefined;
  if (limit !== undefined) {
    total = await repository.count({ where });
  }

  const data = await repository.find(findOptions);
  const executionTime = Date.now() - startTime;

  return {
    data,
    total,
    executionTime,
    fromCache: cache,
  };
}

/**
 * Находит одну запись с оптимизацией запроса
 */
export async function findOneOptimized<T extends ObjectLiteral>(
  repository: Repository<T>,
  id: number | string,
  options: OptimizedQueryOptions<T> = {},
): Promise<T | null> {
  const result = await executeOptimizedQuery(repository, { id } as unknown as FindOptionsWhere<T>, {
    ...options,
    limit: 1,
  });

  return result.data.length > 0 ? result.data[0] : null;
}

/**
 * Находит связанные записи с оптимизацией запроса
 */
export async function findRelatedOptimized<T extends ObjectLiteral>(
  repository: Repository<T>,
  foreignKey: string,
  foreignId: number | string,
  options: OptimizedQueryOptions<T> = {},
): Promise<OptimizedQueryResult<T>> {
  return executeOptimizedQuery(
    repository,
    { [foreignKey]: foreignId } as unknown as FindOptionsWhere<T>,
    options,
  );
}

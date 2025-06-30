/**
 * Утилиты для конвертации между числовыми ID и UUID для использования в тестах
 */

/**
 * Конвертирует числовой ID в строковый UUID для использования в тестах
 * Создает предсказуемый UUID на основе числового ID, что позволяет избежать
 * ошибок invalid input syntax for type uuid
 *
 * @param id - Числовой идентификатор
 * @returns UUID в формате строки
 */
export function numericToUuid(id: number): string {
  // Преобразуем числовой ID в строку и дополняем нулями до 32 символов
  const idStr = id.toString().padStart(8, '0');
  // Создаем UUID формата xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return `${idStr.substring(0, 8)}-0000-4000-8000-${idStr.padStart(12, '0')}`;
}

/**
 * Конвертирует строковый UUID в числовой ID
 * Извлекает числовой ID из UUID, созданного с помощью numericToUuid
 *
 * @param uuid - UUID в формате строки
 * @returns Числовой идентификатор
 */
export function uuidToNumeric(uuid: string): number {
  // Проверяем формат UUID
  if (!uuid || typeof uuid !== 'string') {
    return NaN;
  }

  // Извлекаем первую часть UUID и преобразуем в число
  const firstPart = uuid.split('-')[0];
  return parseInt(firstPart, 10);
}

/**
 * Алиас для uuidToNumeric с более коротким названием
 */
export const fromUuid = uuidToNumeric;

/**
 * Проверяет, является ли строка UUID
 *
 * @param str - Строка для проверки
 * @returns true, если строка является UUID
 */
export function isUuid(str: string): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}

/**
 * Преобразует ID любого типа (number, string, UUID) в UUID
 * Если ID уже является UUID, возвращает его без изменений
 * Если ID является числом или строкой, преобразует в UUID
 *
 * @param id - Идентификатор любого типа
 * @returns UUID в формате строки
 */
export function toUuid(id: number | string): string {
  if (typeof id === 'string') {
    // Если это уже UUID, возвращаем как есть
    if (isUuid(id)) {
      return id;
    }
    // Если это строка с числом, преобразуем в число и затем в UUID
    return numericToUuid(parseInt(id, 10));
  }

  // Если это число, преобразуем в UUID
  return numericToUuid(id);
}

/**
 * Утилиты для конвертации ID между string и number в тестовом окружении
 * Решает проблемы совместимости типов между PostgreSQL и SQLite
 */

/**
 * Преобразует ID в числовой формат
 * @param id ID в любом формате (string или number)
 * @returns ID в числовом формате
 */
export function toNumeric(id: string | number | undefined | null): number | null {
  if (id === undefined || id === null) {
    return null;
  }

  if (typeof id === 'number') {
    return id;
  }

  // Проверка на UUID формат (если это UUID, возвращаем null)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return null;
  }

  const numericId = parseInt(id, 10);
  return isNaN(numericId) ? null : numericId;
}

/**
 * Преобразует ID в строковый формат
 * @param id ID в любом формате (string или number)
 * @returns ID в строковом формате
 */
export function toStringId(id: string | number | undefined | null): string | null {
  if (id === undefined || id === null) {
    return null;
  }

  return String(id);
}

/**
 * Адаптер для работы с ID в тестах с SQLite
 * Предоставляет методы для преобразования и сравнения ID разных типов
 */
export class IdAdapter {
  /**
   * Преобразует ID в формат, подходящий для запросов к базе данных
   */
  static toDbFormat(id: string | number | undefined | null): number | null {
    return toNumeric(id);
  }

  /**
   * Преобразует ID из базы данных в числовой формат
   */
  static fromDbFormat(id: string | number | undefined | null): number | null {
    return toNumeric(id);
  }

  /**
   * Преобразует ID в строковый формат
   */
  static toString(id: string | number | undefined | null): string | null {
    return toStringId(id);
  }

  /**
   * Сравнивает два ID, независимо от их типа
   */
  static areEqual(
    id1: string | number | undefined | null,
    id2: string | number | undefined | null,
  ): boolean {
    if (id1 === undefined || id1 === null || id2 === undefined || id2 === null) {
      return id1 === id2;
    }

    return String(id1) === String(id2);
  }

  /**
   * Выводит отладочную информацию об ID
   */
  static debug(label: string, id: string | number | undefined | null): void {
    console.log(`[IdAdapter] ${label}: ${id}, тип: ${typeof id}`);
  }
}

/**
 * Проверяет, используется ли SQLite в тестовом окружении
 * @returns true, если используется SQLite
 */
export function isUsingSQLite(): boolean {
  return process.env.USE_SQLITE === 'true' || process.env.DB_TYPE === 'sqlite';
}

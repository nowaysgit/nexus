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
 * Преобразует ID любого типа (number, string, UUID) в числовой ID
 * Если ID уже является числом, возвращает его без изменений
 * Если ID является UUID, преобразует в число
 *
 * @param id - Идентификатор любого типа
 * @returns Числовой идентификатор
 */
export function toNumeric(id: number | string): number {
  if (typeof id === 'number') {
    return id;
  }

  if (isUuid(id)) {
    return uuidToNumeric(id);
  }

  return parseInt(id, 10);
}

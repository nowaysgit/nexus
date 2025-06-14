import { Transform } from 'class-transformer';

/**
 * Декоратор для санитизации строковых полей от XSS и HTML-инъекций
 */
export function Sanitize() {
  return Transform(({ value }: { value: string }) => {
    if (typeof value !== 'string') {
      return value;
    }

    return value
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;')
      .replace(/\\/g, '\\\\');
  });
}

/**
 * Декоратор для обрезки пробелов и санитизации строк
 */
export function TrimAndSanitize() {
  return Transform(({ value }: { value: string }) => {
    if (typeof value !== 'string') {
      return value;
    }

    // Сначала обрезаем пробелы
    const trimmed = value.trim();

    // Затем санитизируем от XSS
    return trimmed
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;')
      .replace(/\\/g, '\\\\');
  });
}

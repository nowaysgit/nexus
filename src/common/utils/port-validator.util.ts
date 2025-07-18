/**
 * Валидирует и возвращает корректный порт из переменной окружения
 * @param portEnv Значение переменной окружения PORT
 * @returns Валидный номер порта
 * @throws Error если порт некорректный
 */
export function validatePort(portEnv?: string): number {
  if (!portEnv || portEnv.trim() === '') {
    throw new Error('PORT environment variable is required');
  }

  // Проверяем на специальные форматы чисел (экспоненциальная запись, бинарные, восьмеричные, шестнадцатеричные)
  if (
    portEnv.includes('e') ||
    portEnv.includes('E') ||
    portEnv.startsWith('0b') ||
    portEnv.startsWith('0B') ||
    portEnv.startsWith('0o') ||
    portEnv.startsWith('0O') ||
    portEnv.startsWith('0x') ||
    portEnv.startsWith('0X')
  ) {
    throw new Error(
      `Некорректный PORT в переменных окружения: ${portEnv}. PORT должен быть числом от 1 до 65535`,
    );
  }

  const port = Number(portEnv);

  if (isNaN(port) || port <= 0 || port >= 65536 || !Number.isInteger(port)) {
    throw new Error(
      `Некорректный PORT в переменных окружения: ${portEnv}. PORT должен быть числом от 1 до 65535`,
    );
  }

  return port;
}

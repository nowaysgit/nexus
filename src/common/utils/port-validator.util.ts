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

  const port = Number(portEnv);

  if (isNaN(port) || port <= 0 || port >= 65536) {
    throw new Error(
      `Некорректный PORT в переменных окружения: ${portEnv}. PORT должен быть числом от 1 до 65535`,
    );
  }

  return port;
}

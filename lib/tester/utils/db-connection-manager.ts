import { DataSource } from 'typeorm';

/**
 * Класс для управления соединениями с базой данных в тестах
 * Помогает отслеживать и закрывать соединения для предотвращения ошибки "too many clients"
 */
export class DbConnectionManager {
  private static connections: DataSource[] = [];

  /**
   * Регистрирует соединение для последующего закрытия
   * @param dataSource Соединение с базой данных
   */
  public static registerConnection(dataSource: DataSource): void {
    if (!dataSource) return;

    // Проверяем, что соединение еще не зарегистрировано
    const exists = this.connections.some(conn => conn === dataSource);
    if (!exists) {
      this.connections.push(dataSource);
    }
  }

  /**
   * Закрывает все зарегистрированные соединения
   */
  public static async closeAllConnections(): Promise<void> {
    for (const connection of this.connections) {
      try {
        if (connection && connection.isInitialized) {
          await connection.destroy();
        }
      } catch (error) {
        console.warn('Ошибка при закрытии соединения:', error);
      }
    }

    // Очищаем список соединений
    this.connections = [];

    // Дополнительно пытаемся закрыть все соединения TypeORM
    try {
      const typeOrmConnections = (DataSource as any).connections || [];
      for (const connection of typeOrmConnections) {
        if (connection && connection.isInitialized) {
          await connection.destroy();
        }
      }
    } catch (error) {
      console.warn('Ошибка при закрытии соединений TypeORM:', error);
    }
  }

  /**
   * Получает количество активных соединений
   */
  public static getConnectionCount(): number {
    return this.connections.filter(conn => conn && conn.isInitialized).length;
  }
}

import { Injectable } from '@nestjs/common';

/**
 * Мок для EventEmitter2 для использования в тестах
 */
@Injectable()
export class MockEventEmitter {
  private eventListeners: Record<string, Array<(...args: any[]) => void>> = {};

  /**
   * Регистрирует слушателя события
   * @param event Имя события
   * @param listener Функция обработчик
   * @returns this для цепочки вызовов
   */
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    const eventName = event.toString();
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(listener);
    return this;
  }

  /**
   * Регистрирует одноразового слушателя события
   * @param event Имя события
   * @param listener Функция обработчик
   * @returns this для цепочки вызовов
   */
  once(event: string | symbol, listener: (...args: any[]) => void): this {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    return this.on(event, onceWrapper);
  }

  /**
   * Удаляет слушателя события
   * @param event Имя события
   * @param listener Функция обработчик
   * @returns this для цепочки вызовов
   */
  off(event: string | symbol, listener: (...args: any[]) => void): this {
    const eventName = event.toString();
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName] = this.eventListeners[eventName].filter(
        (l) => l !== listener
      );
    }
    return this;
  }

  /**
   * Удаляет всех слушателей указанного события
   * @param event Имя события (опционально)
   * @returns this для цепочки вызовов
   */
  removeAllListeners(event?: string | symbol): this {
    if (event) {
      const eventName = event.toString();
      delete this.eventListeners[eventName];
    } else {
      this.eventListeners = {};
    }
    return this;
  }

  /**
   * Вызывает событие с указанными аргументами
   * @param event Имя события
   * @param args Аргументы для передачи слушателям
   * @returns true если у события были слушатели, иначе false
   */
  emit(event: string | symbol, ...args: any[]): boolean {
    const eventName = event.toString();
    if (!this.eventListeners[eventName]) {
      return false;
    }
    
    for (const listener of this.eventListeners[eventName]) {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Ошибка в слушателе события ${eventName}:`, error);
      }
    }
    
    return this.eventListeners[eventName].length > 0;
  }

  /**
   * Возвращает массив слушателей для указанного события
   * @param event Имя события
   * @returns Массив слушателей
   */
  listeners(event: string | symbol): Array<(...args: any[]) => void> {
    const eventName = event.toString();
    return this.eventListeners[eventName] || [];
  }

  /**
   * Асинхронный emit, возвращает Promise с результатами всех слушателей
   * @param event Имя события
   * @param args Аргументы для передачи слушателям
   * @returns Promise с массивом результатов всех слушателей
   */
  async emitAsync(event: string | symbol, ...args: any[]): Promise<any[]> {
    const eventName = event.toString();
    if (!this.eventListeners[eventName]) {
      return [];
    }
    
    const results = [];
    for (const listener of this.eventListeners[eventName]) {
      try {
        const result = await listener(...args);
        results.push(result);
      } catch (error) {
        console.error(`Ошибка в асинхронном слушателе события ${eventName}:`, error);
        results.push(null);
      }
    }
    
    return results;
  }

  /**
   * Возвращает всех слушателей
   */
  getListeners(): Record<string, Array<(...args: any[]) => void>> {
    return { ...this.eventListeners };
  }
}

/**
 * Предварительно созданный экземпляр MockEventEmitter для использования в тестах
 */
export const mockEventEmitter = new MockEventEmitter(); 
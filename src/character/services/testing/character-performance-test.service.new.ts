import { Injectable, Logger } from '@nestjs/common';
import { CharacterService } from '../core/character.service';

/**
 * Сервис для тестирования производительности оптимизированных методов
 */
@Injectable()
export class CharacterPerformanceTestService {
  private readonly logger = new Logger(CharacterPerformanceTestService.name);

  constructor(private readonly characterService: CharacterService) {}

  /**
   * Тест производительности получения персонажа
   */
  async testCharacterRetrieval(
    characterId: number,
    iterations: number = 100,
  ): Promise<{
    optimizedResults: { time: number; success: boolean }[];
    standardResults: { time: number; success: boolean }[];
    summary: {
      optimizedAvg: number;
      standardAvg: number;
      improvement: number;
    };
  }> {
    this.logger.log(
      `Начинаем тест производительности получения персонажа (ID: ${characterId}, итераций: ${iterations})`,
    );

    // Очистка кэша перед тестом
    try {
      await this.cacheService.clear();
    } catch (error) {
      this.logger.warn('Не удалось очистить кэш', error);
    }

    const optimizedResults: { time: number; success: boolean }[] = [];
    const standardResults: { time: number; success: boolean }[] = [];

    // Тестируем оптимизированный метод
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        (await this.characterService.getCharacterOptimized?.(characterId)) ||
          (await this.characterService.findOneById(characterId));
        const time = Date.now() - start;
        optimizedResults.push({ time, success: true });
      } catch (error) {
        const time = Date.now() - start;
        optimizedResults.push({ time, success: false });
        this.logger.error(`Ошибка в оптимизированном методе (итерация ${i}):`, error);
      }
    }

    // Очистка кэша между тестами
    try {
      await this.characterService['cacheService']?.invalidateAll();
    } catch (error) {
      this.logger.warn('Не удалось очистить кэш между тестами', error);
    }

    // Тестируем стандартный метод
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        await this.characterService.findOneById(characterId);
        const time = Date.now() - start;
        standardResults.push({ time, success: true });
      } catch (error) {
        const time = Date.now() - start;
        standardResults.push({ time, success: false });
        this.logger.error(`Ошибка в стандартном методе (итерация ${i}):`, error);
      }
    }

    // Анализ результатов
    const optimizedSuccessful = optimizedResults.filter(r => r.success);
    const standardSuccessful = standardResults.filter(r => r.success);

    const optimizedAvg =
      optimizedSuccessful.length > 0
        ? optimizedSuccessful.reduce((sum, r) => sum + r.time, 0) / optimizedSuccessful.length
        : 0;
    const standardAvg =
      standardSuccessful.length > 0
        ? standardSuccessful.reduce((sum, r) => sum + r.time, 0) / standardSuccessful.length
        : 0;

    const improvement = standardAvg > 0 ? ((standardAvg - optimizedAvg) / standardAvg) * 100 : 0;

    this.logger.log(`Тест завершен. Улучшение: ${improvement.toFixed(2)}%`);

    return {
      optimizedResults,
      standardResults,
      summary: { optimizedAvg, standardAvg, improvement },
    };
  }

  /**
   * Тест производительности поиска в памяти
   */
  async testMemorySearch(
    characterId: number,
    query: string,
    iterations: number = 50,
  ): Promise<{
    optimizedResults: { time: number; resultCount: number; success: boolean }[];
    summary: { avgTime: number; avgResults: number };
  }> {
    this.logger.log(
      `Начинаем тест производительности поиска в памяти (ID: ${characterId}, запрос: "${query}", итераций: ${iterations})`,
    );

    // Очистка кэша памяти
    try {
      await this.characterService['cacheService']?.invalidateCharacterMemories?.(characterId);
    } catch (error) {
      this.logger.warn('Не удалось очистить кэш памяти', error);
    }

    const optimizedResults: { time: number; resultCount: number; success: boolean }[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        const results =
          (await this.characterService.searchMemoriesOptimized?.(characterId, query, 20)) ||
          (await this.characterService.searchCharacterMemories?.(characterId, query, 20)) ||
          [];
        const time = Date.now() - start;
        optimizedResults.push({ time, resultCount: results.length, success: true });
      } catch (error) {
        const time = Date.now() - start;
        optimizedResults.push({ time, resultCount: 0, success: false });
        this.logger.error(`Ошибка в поиске памяти (итерация ${i}):`, error);
      }
    }

    const successful = optimizedResults.filter(r => r.success);
    const avgTime =
      successful.length > 0
        ? successful.reduce((sum, r) => sum + r.time, 0) / successful.length
        : 0;
    const avgResults =
      successful.length > 0
        ? successful.reduce((sum, r) => sum + r.resultCount, 0) / successful.length
        : 0;

    this.logger.log(
      `Тест поиска завершен. Среднее время: ${avgTime.toFixed(2)}мс, Среднее кол-во результатов: ${avgResults.toFixed(1)}`,
    );

    return {
      optimizedResults,
      summary: { avgTime, avgResults },
    };
  }

  /**
   * Тест производительности групповых операций
   */
  async testBatchOperations(characterIds: number[]): Promise<{
    batchTime: number;
    individualTime: number;
    improvement: number;
  }> {
    this.logger.log(`Начинаем тест групповых операций (${characterIds.length} персонажей)`);

    // Очистка кэша
    try {
      await this.characterService['cacheService']?.invalidateAll();
    } catch (error) {
      this.logger.warn('Не удалось очистить кэш', error);
    }

    // Тест групповой операции
    const batchStart = Date.now();
    try {
      (await this.characterService.getCharactersBatch?.(characterIds)) ||
        (await Promise.all(characterIds.map(id => this.characterService.findOneById(id))));
    } catch (error) {
      this.logger.error('Ошибка в групповой операции:', error);
    }
    const batchTime = Date.now() - batchStart;

    // Тест индивидуальных операций
    const individualStart = Date.now();
    try {
      await Promise.all(characterIds.map(id => this.characterService.findOneById(id)));
    } catch (error) {
      this.logger.error('Ошибка в индивидуальных операциях:', error);
    }
    const individualTime = Date.now() - individualStart;

    const improvement =
      individualTime > 0 ? ((individualTime - batchTime) / individualTime) * 100 : 0;

    this.logger.log(`Тест групповых операций завершен. Улучшение: ${improvement.toFixed(2)}%`);

    return { batchTime, individualTime, improvement };
  }

  /**
   * Полный тест производительности
   */
  async runFullPerformanceTest(
    characterId: number,
    searchQuery: string = 'test',
  ): Promise<{
    characterRetrieval: Awaited<ReturnType<typeof this.testCharacterRetrieval>>;
    memorySearch: Awaited<ReturnType<typeof this.testMemorySearch>>;
    cacheStats: any;
  }> {
    this.logger.log('Запуск полного теста производительности');

    const [characterRetrieval, memorySearch, cacheStats] = await Promise.all([
      this.testCharacterRetrieval(characterId),
      this.testMemorySearch(characterId, searchQuery),
      this.getCacheStatistics(),
    ]);

    const results = {
      characterRetrieval,
      memorySearch,
      cacheStats,
    };

    this.logger.log('Полный тест производительности завершен');
    return results;
  }

  /**
   * Получение статистики кэша
   */
  private async getCacheStatistics(): Promise<any> {
    try {
      return (
        (await this.characterService['cacheService']?.getStatistics?.()) || {
          message: 'Статистика кэша недоступна',
        }
      );
    } catch (error) {
      this.logger.error('Ошибка получения статистики кэша:', error);
      return { error: 'Не удалось получить статистику кэша' };
    }
  }

  /**
   * Длительный нагрузочный тест
   */
  async runLoadTest(
    characterIds: number[],
    durationMinutes: number = 5,
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    requestsPerSecond: number;
  }> {
    this.logger.log(`Запуск нагрузочного теста на ${durationMinutes} минут`);

    const endTime = Date.now() + durationMinutes * 60 * 1000;
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let totalResponseTime = 0;

    while (Date.now() < endTime) {
      const promises = characterIds.map(async characterId => {
        const start = Date.now();
        totalRequests++;

        try {
          (await this.characterService.getCharacterOptimized?.(characterId)) ||
            (await this.characterService.findOneById(characterId));
          successfulRequests++;
        } catch (error) {
          failedRequests++;
          this.logger.error(`Ошибка при загрузке персонажа ${characterId}:`, error);
        }

        totalResponseTime += Date.now() - start;
      });

      await Promise.all(promises);

      // Небольшая пауза между пакетами запросов
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    const requestsPerSecond = totalRequests / (durationMinutes * 60);

    this.logger.log(
      `Нагрузочный тест завершен. RPS: ${requestsPerSecond.toFixed(2)}, Успешных: ${successfulRequests}, Неудачных: ${failedRequests}`,
    );

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      requestsPerSecond,
    };
  }

  /**
   * Тест масштабируемости
   */
  async runScalabilityTest(): Promise<{
    results: Array<{ characterCount: number; responseTime: number; success: boolean }>;
  }> {
    this.logger.log('Запуск теста масштабируемости');

    const testSizes = [1, 5, 10, 25, 50, 100];
    const results: Array<{ characterCount: number; responseTime: number; success: boolean }> = [];

    for (const size of testSizes) {
      const characterIds = Array.from({ length: size }, (_, i) => i + 1);

      const start = Date.now();
      let success = true;

      try {
        (await this.characterService.getActiveCharacters?.()) ||
          (await Promise.all(characterIds.map(id => this.characterService.findOneById(id))));
      } catch (error) {
        success = false;
        this.logger.error(`Ошибка в тесте масштабируемости для ${size} персонажей:`, error);
      }

      const responseTime = Date.now() - start;
      results.push({ characterCount: size, responseTime, success });

      // Пауза между тестами
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.logger.log('Тест масштабируемости завершен');
    return { results };
  }
}

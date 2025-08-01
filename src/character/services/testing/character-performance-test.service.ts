import { Injectable, Logger } from '@nestjs/common';
import { CharacterService } from '../core/character.service';

/**
 * Сервис для тестирования производительности методов
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
    results: { time: number; success: boolean }[];
    summary: { avgTime: number; successRate: number };
  }> {
    this.logger.log(
      `Начинаем тест производительности получения персонажа (ID: ${characterId}, итераций: ${iterations})`,
    );

    const results: { time: number; success: boolean }[] = [];

    // Тестируем метод получения персонажа
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        await this.characterService.findOneById(characterId);
        const time = Date.now() - start;
        results.push({ time, success: true });
      } catch (error) {
        const time = Date.now() - start;
        results.push({ time, success: false });
        this.logger.error(`Ошибка в методе (итерация ${i}):`, error);
      }
    }

    // Анализ результатов
    const successful = results.filter(r => r.success);
    const avgTime =
      successful.length > 0
        ? successful.reduce((sum, r) => sum + r.time, 0) / successful.length
        : 0;
    const successRate = (successful.length / results.length) * 100;

    this.logger.log(
      `Тест завершен. Среднее время: ${avgTime.toFixed(2)}мс, Успешность: ${successRate.toFixed(2)}%`,
    );

    return {
      results,
      summary: { avgTime, successRate },
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

    // Тест групповой операции
    const batchStart = Date.now();
    try {
      await Promise.all(characterIds.map(id => this.characterService.findOneById(id)));
    } catch (error) {
      this.logger.error('Ошибка в групповой операции:', error);
    }
    const batchTime = Date.now() - batchStart;

    // Тест индивидуальных операций (последовательно)
    const individualStart = Date.now();
    try {
      for (const id of characterIds) {
        await this.characterService.findOneById(id);
      }
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
  async runFullPerformanceTest(characterId: number): Promise<{
    characterRetrieval: {
      results: { time: number; success: boolean }[];
      summary: { avgTime: number; successRate: number };
    };
    batchOperations: {
      batchTime: number;
      individualTime: number;
      improvement: number;
    };
  }> {
    this.logger.log('Запуск полного теста производительности');

    const characterIds = [characterId, characterId + 1, characterId + 2];

    const [characterRetrieval, batchOperations] = await Promise.all([
      this.testCharacterRetrieval(characterId),
      this.testBatchOperations(characterIds),
    ]);

    const results = {
      characterRetrieval,
      batchOperations,
    };

    this.logger.log('Полный тест производительности завершен');
    return results;
  }

  /**
   * Нагрузочный тест
   */
  async runLoadTest(
    characterIds: number[],
    durationMinutes: number = 1,
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
          await this.characterService.findOneById(characterId);
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
}

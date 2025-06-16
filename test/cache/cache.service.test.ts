/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { createTestSuite, createTest } from '../../lib/tester';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { CacheService } from '../../src/cache/cache.service';
import { LogService } from '../../src/logging/log.service';

// Мок LogService
class FakeLogService {
  log() {}

  debug() {}
  // остальные методы опустим
  setContext() {}
}

createTestSuite('CacheService Unit Tests', () => {
  let cacheService: CacheService;

  beforeAll(async () => {
    const moduleRef = await TestModuleBuilder.create()
      .withProviders([{ provide: LogService, useClass: FakeLogService }, CacheService])
      .compile();

    cacheService = moduleRef.get<CacheService>(CacheService);
  });

  createTest({ name: 'should set and get value' }, async () => {
    await cacheService.set('foo', 'bar', 10);
    const value = await cacheService.get('foo');
    expect(value).toBe('bar');
  });

  createTest({ name: 'should return null for expired value' }, async () => {
    await cacheService.set('temp', 42, 0.001); // TTL 1ms
    // Ждём 10мс, чтобы значение истекло
    await new Promise(r => setTimeout(r, 10));
    const value = await cacheService.get('temp');
    expect(value).toBeNull();
  });

  createTest({ name: 'has() should reflect existence' }, async () => {
    await cacheService.set('exist', 1, 10);
    expect(await cacheService.has('exist')).toBe(true);
    await cacheService.del('exist');
    expect(await cacheService.has('exist')).toBe(false);
  });

  createTest({ name: 'evicts oldest when maxItems exceeded' }, async () => {
    // Уменьшаем maxItems через ненадёжный доступ к приватному полю (any) для теста
    (cacheService as any).maxItems = 2;
    await cacheService.clear();

    await cacheService.set('k1', 1, 10);
    await cacheService.set('k2', 2, 10);
    await cacheService.set('k3', 3, 10); // должен вытеснить k1

    const v1 = await cacheService.get('k1');
    const v3 = await cacheService.get('k3');

    expect(v1).toBeNull();
    expect(v3).toBe(3);
  });
});

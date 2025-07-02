import { Type, DynamicModule, Provider } from '@nestjs/common';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import {
  TestConfigurations,
  containsTelegrafModule,
  replaceTelegrafModule,
} from '../test-configurations';
import { TelegrafTokenProvider } from '../mocks/telegraf-token.provider';
import { MockTypeOrmModule } from '../mocks/mock-typeorm.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_TEST_ENTITIES } from '../entities';

/**
 * Интерфейс для конфигурации тестового модуля
 */
export interface TestModuleConfig {
  imports?: (Type<any> | DynamicModule)[];
  providers?: Provider[];
  controllers?: Type<any>[];
  exports?: (Type<any> | DynamicModule | string | symbol)[];
}

/**
 * Класс для построения тестовых модулей с автоматическими моками
 */
export class TestModuleBuilder {
  private imports: (Type<any> | DynamicModule)[] = [];
  private providers: Provider[] = [];
  private controllers: Type<any>[] = [];
  private exports: (Type<any> | DynamicModule | string | symbol)[] = [];
  private requiresDatabase: boolean = false;

  // Кеш скомпилированных модулей для ускорения
  private static moduleCache = new Map<string, TestingModule>();
  private static builderCache = new Map<string, TestingModuleBuilder>();

  /**
   * Создает новый экземпляр TestModuleBuilder
   * @returns новый экземпляр TestModuleBuilder
   */
  static create(): TestModuleBuilder {
    return new TestModuleBuilder();
  }

  /**
   * Генерирует ключ для кеширования на основе конфигурации модуля
   */
  private generateCacheKey(): string {
    const importsKeys = this.imports
      .map(imp => {
        if (typeof imp === 'function') {
          return imp.name;
        }
        if (typeof imp === 'object' && imp !== null && 'module' in imp) {
          const dynamicModule = imp;
          if (typeof dynamicModule.module === 'function') {
            return dynamicModule.module.name;
          }
        }
        return JSON.stringify(imp);
      })
      .sort()
      .join(',');
    const providersKeys = this.providers
      .map(p => this.getProviderTokenName(p))
      .sort()
      .join(',');
    const controllersKeys = this.controllers
      .map(c => c.name)
      .sort()
      .join(',');

    return `${importsKeys}|${providersKeys}|${controllersKeys}|${this.requiresDatabase}`;
  }

  /**
   * Добавляет импорты в тестовый модуль
   * @param imports массив импортов
   * @returns this для цепочки вызовов
   */
  withImports(imports: (Type<any> | DynamicModule)[]): TestModuleBuilder {
    this.imports = [...this.imports, ...imports];

    // Проверяем, содержит ли импорты TypeOrmModule.forRoot() (но НЕ forFeature())
    const hasTypeOrmForRoot = imports.some(imp => {
      if (imp === TypeOrmModule) {
        return true;
      }

      if (typeof imp === 'object' && imp !== null && 'module' in imp) {
        const dynamicModule = imp;
        const isTypeOrmModule = dynamicModule.module === TypeOrmModule;

        if (isTypeOrmModule && dynamicModule.providers) {
          // A simple heuristic: forRoot usually has many providers
          return dynamicModule.providers.length > 10;
        }
      }
      return false;
    });

    if (hasTypeOrmForRoot) {
      this.requiresDatabase = true;
    }

    return this;
  }

  /**
   * Добавляет провайдеры в тестовый модуль, заменяя существующие с тем же токеном
   * @param providers массив провайдеров
   * @returns this для цепочки вызовов
   */
  withProviders(providers: Provider[]): TestModuleBuilder {
    // Create a Map to track providers by their tokens
    const providerMap = new Map<any, Provider>();

    // Add existing providers
    this.providers.forEach(provider => {
      const token = this.getProviderToken(provider);
      providerMap.set(token, provider);
    });

    // Add/replace new providers
    providers.forEach(provider => {
      const token = this.getProviderToken(provider);
      providerMap.set(token, provider);
    });

    // Convert the Map back to an array
    this.providers = Array.from(providerMap.values());
    return this;
  }

  private getProviderToken(provider: Provider): any {
    if (typeof provider === 'function') {
      return provider; // Class provider
    }

    if (typeof provider === 'object' && provider !== null) {
      if ('provide' in provider) {
        return provider.provide; // Value/Factory/Class provider with provide token
      }
      if ('useClass' in provider || 'useValue' in provider || 'useFactory' in provider) {
        return provider; // Provider without explicit provide token
      }
    }

    return provider; // Fallback
  }

  private getProviderTokenName(provider: Provider): string {
    const token = this.getProviderToken(provider);
    if (typeof token === 'function') {
      return token.name;
    }
    if (typeof token === 'string' || typeof token === 'symbol') {
      return token.toString();
    }
    return JSON.stringify(token);
  }

  /**
   * Добавляет контроллеры в тестовый модуль
   * @param controllers массив контроллеров
   * @returns this для цепочки вызовов
   */
  withControllers(controllers: Type<any>[]): TestModuleBuilder {
    this.controllers = [...this.controllers, ...controllers];
    return this;
  }

  /**
   * Добавляет экспорты в тестовый модуль
   * @param exports массив экспортов
   * @returns this для цепочки вызовов
   */
  withExports(exports: (Type<any> | DynamicModule | string | symbol)[]): TestModuleBuilder {
    this.exports = [...this.exports, ...exports];
    return this;
  }

  /**
   * Добавляет моки для указанных репозиториев
   * @param entities Массив сущностей для мокирования
   * @returns this для цепочки вызовов
   */
  withMockedRepositories(entities: (Type<any> | Function)[]): TestModuleBuilder {
    const mockRepositoryModule = MockTypeOrmModule.forFeature(entities as Type<any>[]);
    this.imports.push(mockRepositoryModule);
    // Также добавляем провайдеры из этого модуля, чтобы они были доступны для инъекции
    if (mockRepositoryModule.providers) {
      this.providers.push(...mockRepositoryModule.providers);
    }
    return this;
  }

  /**
   * Указывает, что тест требует доступ к базе данных
   * @param required true если требуется база данных, false если нет
   * @returns this для цепочки вызовов
   */
  withDatabase(required: boolean = true): TestModuleBuilder {
    this.requiresDatabase = required;
    return this;
  }

  /**
   * Подготавливает импорты для тестирования, заменяя TelegrafModule на MockTelegramModule.forRoot()
   * @returns this для цепочки вызовов
   */
  withTelegramMock(): TestModuleBuilder {
    if (containsTelegrafModule(this.imports)) {
      this.imports = replaceTelegrafModule(this.imports);
      this.providers = [...this.providers, TelegrafTokenProvider];
    }
    return this;
  }

  /**
   * Добавляет все необходимые моки на основе импортируемых модулей
   * @returns this для цепочки вызовов
   */
  withRequiredMocks(): TestModuleBuilder {
    this.providers = TestConfigurations.requiredMocksAdder(this.imports, this.providers);
    return this;
  }

  /**
   * Заменяет TypeOrmModule на MockTypeOrmModule
   * @returns this для цепочки вызовов
   */
  withMockTypeOrm(): TestModuleBuilder {
    // Заменяем TypeOrmModule.forRoot() на MockTypeOrmModule.forRoot()
    this.imports = this.imports.map(imp => {
      const isTypeOrmForRoot =
        imp &&
        typeof imp === 'object' &&
        'module' in imp &&
        imp.module === TypeOrmModule &&
        'providers' in imp &&
        Array.isArray(imp.providers) &&
        imp.providers.length > 0;

      if (isTypeOrmForRoot) {
        return MockTypeOrmModule.forRoot();
      }

      // ИСПРАВЛЕНИЕ: Правильно заменяем TypeOrmModule.forFeature() на MockTypeOrmModule.forFeature()
      const isTypeOrmForFeature =
        imp &&
        typeof imp === 'object' &&
        'module' in imp &&
        imp.module === TypeOrmModule &&
        'providers' in imp &&
        Array.isArray(imp.providers) &&
        imp.providers.length > 0;

      if (isTypeOrmForFeature) {
        // Извлекаем сущности из оригинального модуля
        const entities: Type<any>[] = [];
        const providers = imp.providers || [];

        // Ищем провайдеры репозиториев и извлекаем сущности
        for (const provider of providers) {
          if (
            provider &&
            typeof provider === 'object' &&
            'provide' in provider &&
            typeof (provider as any).provide === 'string'
          ) {
            const token = (provider as any).provide;
            // Токен репозитория имеет формат 'TypeOrmToken:EntityName'
            if (token.includes('TypeOrmToken:')) {
              const entityName = token.replace('TypeOrmToken:', '');
              // Ищем сущность по имени в ALL_TEST_ENTITIES
              const entity = ALL_TEST_ENTITIES.find(e => e.name === entityName);
              if (entity) {
                entities.push(entity);
              }
            }
          }
        }

        // Если не нашли сущности через токены, попробуем найти их через другие способы
        if (entities.length === 0) {
          // Иногда сущности передаются напрямую в options модуля
          const dynamicModule = imp;
          if (dynamicModule.imports) {
            const typeOrmForFeature = dynamicModule.imports.find(
              i =>
                i &&
                typeof i === 'object' &&
                'module' in i &&
                (i as any).module === TypeOrmModule &&
                'entities' in (i as any),
            ) as DynamicModule & { entities: Type<any>[] };

            if (typeOrmForFeature && typeOrmForFeature.entities) {
              entities.push(...typeOrmForFeature.entities);
            }
          } else {
            // Как fallback используем основные сущности
            entities.push(...ALL_TEST_ENTITIES.slice(0, 5)); // Character, User, Dialog, Need, Action
          }
        }

        return MockTypeOrmModule.forFeature(entities);
      }

      return imp;
    });

    // Также заменяем импорты самого TypeOrmModule без providers
    this.imports = this.imports.map(imp => {
      if (imp === TypeOrmModule) {
        return MockTypeOrmModule.forRoot();
      }
      return imp;
    });

    // Если нет MockTypeOrmModule.forRoot() в импортах, добавляем его
    const hasMockTypeOrm = this.imports.some(
      imp => (imp as any)?.module === MockTypeOrmModule || imp === MockTypeOrmModule,
    );

    if (!hasMockTypeOrm) {
      this.imports.unshift(MockTypeOrmModule.forRoot());
    }

    return this;
  }

  /**
   * Создает тестовый модуль с автоматическими моками
   * @returns TestingModuleBuilder для дальнейшей настройки
   */
  build(): TestingModuleBuilder {
    const cacheKey = this.generateCacheKey();

    // Проверяем наличие скомпилированного билдера в кеше
    if (TestModuleBuilder.builderCache.has(cacheKey)) {
      return TestModuleBuilder.builderCache.get(cacheKey);
    }

    // Добавляем моки по умолчанию
    this.withRequiredMocks();
    this.withTelegramMock();

    // Если тест требует БД, но она не была явно добавлена, добавляем мок
    if (this.requiresDatabase) {
      const hasTypeOrm = this.imports.some(
        imp =>
          (imp as any) === MockTypeOrmModule ||
          (typeof imp === 'object' &&
            imp !== null &&
            'module' in imp &&
            (imp as any).module === MockTypeOrmModule),
      );

      if (!hasTypeOrm) {
        this.imports.push(MockTypeOrmModule.forRoot());
      }
    }

    const testingModuleBuilder: TestingModuleBuilder = Test.createTestingModule({
      imports: this.imports,
      providers: this.providers,
      controllers: this.controllers,
      exports: this.exports,
    });

    TestModuleBuilder.builderCache.set(cacheKey, testingModuleBuilder);
    return testingModuleBuilder;
  }

  /**
   * Компилирует тестовый модуль с кешированием
   * @returns Promise с скомпилированным TestingModule
   */
  async compile(): Promise<TestingModule> {
    const cacheKey = this.generateCacheKey();

    // Проверяем кеш для скомпилированного модуля
    if (TestModuleBuilder.moduleCache.has(cacheKey)) {
      return TestModuleBuilder.moduleCache.get(cacheKey);
    }

    const module = await this.build().compile();

    // Кешируем скомпилированный модуль
    TestModuleBuilder.moduleCache.set(cacheKey, module);

    return module;
  }

  /**
   * Очищает кеш модулей (полезно для тестов)
   */
  static clearCache(): void {
    TestModuleBuilder.moduleCache.clear();
    TestModuleBuilder.builderCache.clear();
  }

  /**
   * Позволяет переопределить провайдер для тестов
   * @param token Токен провайдера
   * @returns Объект для указания нового значения/класса/фабрики
   */
  overrideProvider<T = any>(
    token: string | symbol | Type<T> | ((...args: any[]) => any),
  ): {
    useValue: (value: T) => TestModuleBuilder;
    useClass: (value: Type<T>) => TestModuleBuilder;
    useFactory: (value: (...args: any[]) => T) => TestModuleBuilder;
  } {
    const provider = this.findProvider(token);
    if (provider) {
      this.providers = this.providers.filter(p => p !== provider);
    }

    return {
      useValue: (value: T): TestModuleBuilder => {
        this.providers.push({ provide: token, useValue: value });
        return this;
      },
      useClass: (value: Type<T>): TestModuleBuilder => {
        this.providers.push({ provide: token, useClass: value });
        return this;
      },
      useFactory: (value: (...args: any[]) => T): TestModuleBuilder => {
        this.providers.push({ provide: token, useFactory: value });
        return this;
      },
    };
  }

  private findProvider(
    token: string | symbol | Type<any> | ((...args: any[]) => any),
  ): Provider | undefined {
    return this.providers.find(p => {
      const providerToken = this.getProviderToken(p);
      return token === providerToken;
    });
  }
}

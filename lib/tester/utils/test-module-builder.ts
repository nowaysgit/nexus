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
import { TestConfigType } from '../index';

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
      .map(imp => (imp as any)?.name || (imp as any)?.module?.name || JSON.stringify(imp))
      .sort()
      .join(',');
    const providersKeys = this.providers
      .map(p => (p as any)?.provide?.name || (p as any)?.name || JSON.stringify(p))
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
      const moduleName = (imp as any)?.name || (imp as any)?.module?.name;
      const isTypeOrmModule = moduleName === 'TypeOrmModule' || imp === TypeOrmModule;

      // Если это просто TypeOrmModule класс (без forRoot/forFeature), считаем что это forRoot
      if (imp === TypeOrmModule) {
        return true;
      }

      // Если это TypeOrmModule с providers, проверяем что это forRoot (имеет много providers)
      // forFeature обычно имеет только несколько providers для репозиториев
      if (isTypeOrmModule && (imp as any)?.providers) {
        const providersCount = (imp as any).providers.length;
        // forRoot имеет много providers (DataSource, Connection, etc.)
        // forFeature имеет только несколько providers для репозиториев
        return providersCount > 10; // Эвристика: forRoot имеет больше providers
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
    // Создаем Map для отслеживания провайдеров по токенам
    const providerMap = new Map<any, Provider>();

    // Добавляем существующие провайдеры
    this.providers.forEach(provider => {
      const token = this.getProviderToken(provider);
      providerMap.set(token, provider);
    });

    // Добавляем/заменяем новые провайдеры
    providers.forEach(provider => {
      const token = this.getProviderToken(provider);
      providerMap.set(token, provider);
    });

    // Преобразуем Map обратно в массив
    this.providers = Array.from(providerMap.values());
    return this;
  }

  /**
   * Извлекает токен провайдера для сравнения
   * @param provider провайдер
   * @returns токен провайдера
   */
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
        ((imp as any)?.module === TypeOrmModule && (imp as any)?.providers?.length > 0) ||
        ((imp as any)?.name === 'TypeOrmModule' && (imp as any)?.providers?.length > 0);

      if (isTypeOrmForRoot) {
        return MockTypeOrmModule.forRoot();
      }

      // ИСПРАВЛЕНИЕ: Правильно заменяем TypeOrmModule.forFeature() на MockTypeOrmModule.forFeature()
      const isTypeOrmForFeature =
        (imp as any)?.module === TypeOrmModule && (imp as any)?.providers?.length > 0;

      if (isTypeOrmForFeature) {
        // Извлекаем сущности из оригинального модуля
        const entities = [];
        const providers = (imp as any).providers || [];

        // Ищем провайдеры репозиториев и извлекаем сущности
        for (const provider of providers) {
          if (provider && provider.provide && typeof provider.provide === 'string') {
            const token = provider.provide;
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
          const options = (imp as any).options;
          if (options && options.entities) {
            entities.push(...options.entities);
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

    // Проверяем кеш для готового билдера
    if (TestModuleBuilder.builderCache.has(cacheKey)) {
      return TestModuleBuilder.builderCache.get(cacheKey);
    }

    // Устанавливаем глобальный контекст для MockTypeOrmModule
    (global as any).__currentTest = {
      params: {
        requiresDatabase: this.requiresDatabase,
      },
    };

    // Подготавливаем импорты для тестирования (замена TelegrafModule, LoggingModule и др.)
    // Если requiresDatabase=true, это интеграционный тест - передаем TestConfigType.INTEGRATION
    const configTypeForImports = this.requiresDatabase ? TestConfigType.INTEGRATION : undefined;
    this.imports = TestConfigurations.prepareImportsForTesting(this.imports, configTypeForImports);

    this.withTelegramMock();

    // Заменяем TypeOrmModule на MockTypeOrmModule ТОЛЬКО для unit тестов
    // Для интеграционных тестов (requiresDatabase = true) используем реальный TypeOrmModule
    if (!this.requiresDatabase) {
      console.log('[DEBUG] TestModuleBuilder: requiresDatabase is false, using mocks');
      this.withMockTypeOrm();

      // Добавляем MockTypeOrmModule.forFeature() для всех сущностей если нет TypeOrmModule.forFeature()
      const hasTypeOrmForFeature = this.imports.some(
        imp =>
          (imp as any)?.module === TypeOrmModule &&
          (imp as any)?.providers?.length > 0 &&
          !(imp as any)?.global,
      );

      console.log('[DEBUG] TestModuleBuilder: hasTypeOrmForFeature =', hasTypeOrmForFeature);

      if (!hasTypeOrmForFeature) {
        console.log(
          '[DEBUG] TestModuleBuilder: Adding MockTypeOrmModule.forFeature with ALL_TEST_ENTITIES',
        );
        // Добавляем все сущности для unit тестов
        this.imports.push(MockTypeOrmModule.forFeature(ALL_TEST_ENTITIES));
      }
    } else {
      console.log('[DEBUG] TestModuleBuilder: requiresDatabase is true, adding real TypeOrmModule');

      // Для интеграционных тестов добавляем реальный TypeOrmModule
      const hasTypeOrmModule = this.imports.some(
        imp => imp === TypeOrmModule || (imp as any)?.module === TypeOrmModule,
      );

      if (!hasTypeOrmModule) {
        // Добавляем TypeOrmModule.forRoot() для интеграционных тестов
        this.imports.unshift(
          TypeOrmModule.forRootAsync({
            useFactory: async () => {
              return {
                type: 'postgres',
                host: '127.0.0.1', // Используем IP вместо localhost
                port: parseInt(process.env.DB_TEST_PORT || '5433', 10),
                username: process.env.DB_TEST_USER || 'test_user',
                password: process.env.DB_TEST_PASSWORD || 'test_password',
                database: process.env.DB_TEST_NAME || 'nexus_test',
                entities: ALL_TEST_ENTITIES,
                synchronize: false,
                dropSchema: false,
                connectTimeoutMS: 5000, // Уменьшил таймаут
                acquireTimeoutMS: 5000, // Уменьшил таймаут
                timeout: 5000, // Уменьшил таймаут
                extra: {
                  connectionTimeoutMillis: 5000,
                  idleTimeoutMillis: 10000,
                  max: 2, // Уменьшил количество подключений
                  min: 1,
                  statement_timeout: 10000,
                  query_timeout: 10000,
                  acquireTimeoutMillis: 5000,
                },
                logging: false, // Отключил логирование
                retryAttempts: 1, // Уменьшил количество попыток
                retryDelay: 1000,
              };
            },
          }),
        );
      }

      // Добавляем TypeOrmModule.forFeature() если его нет
      const hasTypeOrmForFeature = this.imports.some(
        imp =>
          (imp as any)?.module === TypeOrmModule &&
          (imp as any)?.providers?.length > 0 &&
          !(imp as any)?.global,
      );

      if (!hasTypeOrmForFeature) {
        console.log(
          '[DEBUG] TestModuleBuilder: Adding TypeOrmModule.forFeature with ALL_TEST_ENTITIES',
        );
        this.imports.push(TypeOrmModule.forFeature(ALL_TEST_ENTITIES));
      }
    }

    this.withRequiredMocks();

    const builder =
      TestModuleBuilder.builderCache.get(cacheKey) ||
      Test.createTestingModule({
        imports: this.imports,
        providers: this.providers,
        controllers: this.controllers,
        exports: this.exports,
      });
    TestModuleBuilder.builderCache.set(cacheKey, builder);
    return builder;
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
}

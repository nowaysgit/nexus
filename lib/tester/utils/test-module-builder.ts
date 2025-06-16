import { Type, DynamicModule, Provider } from '@nestjs/common';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import {
  TestConfigurations,
  containsTelegrafModule,
  replaceTelegrafModule,
} from '../test-configurations';
import { TelegrafTokenProvider } from '../mocks/telegraf-token.provider';

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

  /**
   * Создает новый экземпляр TestModuleBuilder
   * @returns новый экземпляр TestModuleBuilder
   */
  static create(): TestModuleBuilder {
    return new TestModuleBuilder();
  }

  /**
   * Добавляет импорты в тестовый модуль
   * @param imports массив импортов
   * @returns this для цепочки вызовов
   */
  withImports(imports: (Type<any> | DynamicModule)[]): TestModuleBuilder {
    this.imports = [...this.imports, ...imports];
    return this;
  }

  /**
   * Добавляет провайдеры в тестовый модуль
   * @param providers массив провайдеров
   * @returns this для цепочки вызовов
   */
  withProviders(providers: Provider[]): TestModuleBuilder {
    this.providers = [...this.providers, ...providers];
    return this;
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
   * Создает тестовый модуль с автоматическими моками
   * @returns TestingModuleBuilder для дальнейшей настройки
   */
  build(): TestingModuleBuilder {
    // Подготавливаем импорты для тестирования (замена TelegrafModule, LoggingModule и др.)
    this.imports = TestConfigurations.prepareImportsForTesting(this.imports);

    this.withTelegramMock();

    // Добавляем все необходимые моки
    this.withRequiredMocks();

    return Test.createTestingModule({
      imports: this.imports,
      providers: this.providers,
      controllers: this.controllers,
      exports: this.exports,
    });
  }

  /**
   * Компилирует тестовый модуль
   * @returns Promise с скомпилированным TestingModule
   */
  async compile(): Promise<TestingModule> {
    return this.build().compile();
  }
}

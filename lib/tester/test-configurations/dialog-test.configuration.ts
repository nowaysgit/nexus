/**
 * Конфигурация для тестирования DialogService с типизированными моками и автоматическим добавлением UserService.
 * Улучшена обработка ошибок и типизация для повышения надежности тестов.
 */
import { mockUserService } from '../mocks/user-service.mock';
import { TestConfigType } from '../index';
import { Provider, Type, DynamicModule } from '@nestjs/common';

/**
 * Получить тестовую конфигурацию для DialogModule с правильно типизированным UserService
 * @returns Объект конфигурации для DialogService тестов
 */
export function getDialogTestConfig() {
  return {
    type: TestConfigType.INTEGRATION,
    requiresDatabase: true,
    providers: [
      {
        provide: 'UserService',
        useValue: mockUserService,
      },
    ],
  };
}

/**
 * Проверить наличие DialogModule в импортах
 * @param imports Массив импортируемых модулей
 * @returns true, если DialogModule найден в импортах
 */
export function containsDialogModule(imports: (Type<any> | DynamicModule)[]): boolean {
  if (!imports) {
    return false;
  }

  return imports.some(importedModule => {
    // Проверка для классов (функций)
    if (typeof importedModule === 'function') {
      return importedModule.name === 'DialogModule';
    }

    // Проверка для объектов
    if (typeof importedModule === 'object' && importedModule !== null) {
      // Проверяем свойство name
      if ('name' in importedModule && typeof importedModule.name === 'string') {
        return importedModule.name === 'DialogModule';
      }

      // Безопасное преобразование в строку для поиска DialogModule
      try {
        const stringRepresentation = JSON.stringify(importedModule);
        return stringRepresentation.includes('DialogModule');
      } catch (_err) {
        // Игнорируем ошибки при преобразовании в строку
      }
    }

    return false;
  });
}

/**
 * Добавить типизированный mockUserService в провайдеры
 * @param providers Массив провайдеров
 * @returns Обновленный массив провайдеров с добавленным mockUserService
 */
export function addMockUserServiceToProviders(providers: Provider[] = []): Provider[] {
  // Проверяем, что mockUserService еще не добавлен
  const mockUserServiceExists = providers.some(provider => {
    if (typeof provider === 'object' && provider !== null && 'provide' in provider) {
      return provider.provide === 'UserService';
    }
    return false;
  });

  if (!mockUserServiceExists) {
    providers.push({
      provide: 'UserService',
      useValue: mockUserService,
    });
  }

  return providers;
}

/**
 * Добавляет необходимые моки для тестирования DialogService
 * @param imports Массив импортируемых модулей
 * @param providers Массив провайдеров
 * @returns Обновленный массив провайдеров с добавленными моками для DialogService
 */
export function addDialogServiceMocks(
  imports: (Type<any> | DynamicModule)[],
  providers: Provider[] = [],
): Provider[] {
  if (containsDialogModule(imports)) {
    return addMockUserServiceToProviders(providers);
  }

  return providers;
}

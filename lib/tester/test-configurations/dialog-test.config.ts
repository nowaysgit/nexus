/**
 * Конфигурация для тестирования DialogService с автоматическим добавлением мока UserService
 */
import { mockUserService } from '../mocks/user-service.mock';
import { TestConfigType } from '../index';
import { Provider, Type, DynamicModule } from '@nestjs/common';

/**
 * Получить тестовую конфигурацию для DialogModule
 */
export function getDialogTestConfig() {
  return {
    type: TestConfigType.INTEGRATION,
    database: true,
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
 */
export function containsDialogModule(imports: (Type<any> | DynamicModule)[]): boolean {
  if (!imports) {
    return false;
  }
  return imports.some(importedModule => {
    if (typeof importedModule === 'string') {
      return importedModule === 'DialogModule';
    }
    const moduleName = (importedModule as any)?.name || (importedModule as any)?.module?.name;
    if (moduleName) {
      return moduleName === 'DialogModule';
    }
    if (typeof importedModule.toString === 'function') {
      return importedModule.toString().includes('class DialogModule');
    }
    return false;
  });
}

/**
 * Добавить mockUserService в провайдеры
 */
export function addMockUserServiceToProviders(providers: Provider[]): Provider[] {
  if (!providers) {
    providers = [];
  }

  // Проверяем, что mockUserService еще не добавлен
  const mockUserServiceExists = providers.some(
    provider => (provider as any).provide === 'UserService',
  );

  if (!mockUserServiceExists) {
    providers.push({
      provide: 'UserService',
      useValue: mockUserService,
    });
  }

  return providers;
}

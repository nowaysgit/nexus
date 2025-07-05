import { ActionExecutorService } from '../../../src/character/services/action/action-executor.service';
import { ActionLifecycleService } from '../../../src/character/services/action/action-lifecycle.service';
import { ActionSchedulerService } from '../../../src/character/services/action/action-scheduler.service';
import { ActionGeneratorService } from '../../../src/character/services/action/action-generator.service';
import { ActionResourceService } from '../../../src/character/services/action/action-resource.service';

import { TechniqueHistoryService } from '../../../src/character/services/technique/technique-history.service';
import { TechniqueStrategyService } from '../../../src/character/services/technique/technique-strategy.service';
import { TechniqueExecutorService } from '../../../src/character/services/technique/technique-executor.service';
/* eslint-disable */

/**
 * Центральный экспорт тестовых конфигураций и утилит
 */

import { Provider, Type, DynamicModule } from '@nestjs/common';
import {
  getDialogTestConfig,
  addMockUserServiceToProviders,
  containsDialogModule,
  addDialogServiceMocks
} from './dialog-test.configuration';
import { mockUserService } from '../mocks/user-service.mock';
import {
  containsTelegramModule,
  addMockTelegramServiceToProviders,
  addTelegrafTokenToProviders,
  replaceTelegrafModule,
  containsTelegrafModule,
} from './telegram-test.configuration';
import { addLoggingMocks } from './logging-test.configuration';
import { addLLMMocks, containsLLMModule } from './llm-test.configuration';
import { ConfigServiceProvider } from '../mocks/config.service.mock';
import { mockConfigService } from '../mocks/config.service.mock';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { TelegrafTokenProvider } from '../mocks/telegraf-token.provider';
import { TELEGRAF_TOKEN } from '../../../src/telegram/constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MockEventEmitter } from '../mocks/event-emitter.mock';
import { CacheService } from '../../../src/cache/cache.service';
import { DataSource } from 'typeorm';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { MockLoggingModule } from '../mocks/mock-logging.module';
import { LoggingModule } from '../../../src/logging/logging.module';
import { MockTypeOrmModule } from '../mocks/mock-typeorm.module';
import { MockProviderFactory } from '../mocks/mock-provider';
import { MockApiKeyService, MockEncryptionService } from '../mocks';
import { ApiKeyService } from '../../../src/infrastructure/api-key.service';
import { EncryptionService } from '../../../src/infrastructure/encryption.service';
import { MockDialogRepositoryModule } from '../mocks/mock-dialog-repository.module';
import { MockLogService } from '../mocks/log.service.mock';
import { MockRollbarService } from '../mocks/rollbar.service.mock';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { TelegrafTokenMockModule } from '../mocks/telegraf-token.module';
import { TestConfigType } from '../index';
import { MessageQueueService } from '../../../src/message-queue/message-queue.service';
import { LLMService } from '../../../src/llm/services/llm.service';

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable import/no-commonjs */
/* eslint-disable @typescript-eslint/no-unsafe-return */

// Определяем интерфейс для конфигурации
export interface TestConfig {
  providers: Provider[];
  [key: string]: any;
}

// Экспортируем функции из других модулей
export * from './logging-test.configuration';
export * from './llm-test.configuration';
export * from './telegram-test.configuration';
export * from './dialog-test.configuration';

/**
 * Автоматически добавляет все необходимые моки на основе импортируемых модулей
 * @param imports массив импортов модулей
 * @param providers массив провайдеров
 * @returns обновленный массив провайдеров с добавленными моками
 */
export function requiredMocksAdder(
  imports: (Type<any> | DynamicModule)[] = [],
  providers: Provider[] = [],
): Provider[] {
  let updatedProviders = [...providers];

  // Если в импортах есть DialogModule, добавляем мок UserService
  if (containsDialogModule(imports)) {
    updatedProviders = addMockUserServiceToProviders(updatedProviders);
  }

  // Если в импортах есть TelegramModule, добавляем мок TelegramService
  if (containsTelegramModule(imports)) {
    updatedProviders = addMockTelegramServiceToProviders(updatedProviders);
  }

  // Всегда добавляем TelegrafTokenProvider — упрощает настройку тестов и устраняет ошибки
    updatedProviders = addTelegrafTokenToProviders(updatedProviders);

  // Если в импортах есть TelegrafModule, добавляем TelegrafTokenProvider
  if (containsTelegrafModule(imports)) {
    updatedProviders = addTelegrafTokenToProviders(updatedProviders);
  }

  // Если в импортах есть LLMModule, добавляем мок LLMService
  if (containsLLMModule(imports)) {
    const config = { providers: updatedProviders };
    const updatedConfig = addLLMMocks(config);
    updatedProviders = updatedConfig.providers;
  }

  // Всегда добавляем моки для LoggingModule
  const config = { providers: updatedProviders };
  const updatedConfig = addLoggingMocks(config);
  updatedProviders = updatedConfig.providers;

  // Добавляем ConfigService, только если ConfigModule не импортирован (иначе конфиг уже доступен)
  const hasConfigModule = imports.some(
    imp => (imp as any)?.module === ConfigModule || imp === ConfigModule,
  );

  if (!hasConfigModule) {
  updatedProviders = addConfigServiceProvider(updatedProviders);
  }

  // Добавляем CacheService, если он ещё не добавлен
  const hasCacheService = updatedProviders.some(
    (p: any) => p === CacheService || p?.provide === CacheService,
  );

  if (!hasCacheService) {
    updatedProviders.push({
      provide: CacheService,
      useValue: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(null),
        has: jest.fn().mockResolvedValue(false),
        del: jest.fn().mockResolvedValue(false),
        delete: jest.fn().mockResolvedValue(false),
        clear: jest.fn().mockResolvedValue(null),
      },
    });
  }

  // Добавляем MockEventEmitter для EventEmitter2, если он ещё не добавлен
  const hasEventEmitter = updatedProviders.some(
    (p: any) => p === EventEmitter2 || p?.provide === EventEmitter2,
  );

  if (!hasEventEmitter) {
    updatedProviders.push({
      provide: EventEmitter2,
      useValue: new MockEventEmitter(),
    });
  }

  // Добавляем мок для MessageQueueService
  const hasMessageQueueService = updatedProviders.some(
    (p: any) => p === MessageQueueService || p?.provide === MessageQueueService,
  );
  if (!hasMessageQueueService) {
    updatedProviders.push({
      provide: MessageQueueService,
      useValue: {
        publish: jest.fn(),
        subscribe: jest.fn(),
      },
    });
  }

  // Добавляем мок для LLMService
  const hasLLMService = updatedProviders.some(
    (p: any) => p === LLMService || p?.provide === LLMService,
  );
  if (!hasLLMService) {
    updatedProviders.push({
      provide: LLMService,
      useValue: {
        generateText: jest.fn().mockResolvedValue('mocked LLM response'),
        generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      },
    });
  }

  // Добавляем DATA_SOURCE для FixtureManager
  updatedProviders = addDataSourceProvider(updatedProviders);

  // Добавляем WINSTON_MODULE_PROVIDER, если его еще нет
  if (!updatedProviders.some(provider => (provider as any)?.provide === WINSTON_MODULE_PROVIDER)) {
    updatedProviders.push({
      provide: WINSTON_MODULE_PROVIDER,
      useValue: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      },
    });
  }

  // Добавляем телеграм-заглушки для обработчиков, если они не были предоставлены
  const telegramStubProviders: Provider[] = [];
  const telegramHandlerPaths = [
    '../mocks/telegram-handler-stubs', // We'll create aggregated export of stubs
  ];

  // Dynamically import handler classes to avoid heavy dependencies when not present
  let MessageHandler: any;
  let CommandHandler: any;
  let CallbackHandler: any;
  let TelegramUpdate: any;
  try {
    ({ MessageHandler } = require('../../../src/telegram/handlers/message.handler'));
  } catch {}
  try {
    ({ CommandHandler } = require('../../../src/telegram/handlers/command.handler'));
  } catch {}
  try {
    ({ CallbackHandler } = require('../../../src/telegram/handlers/callback.handler'));
  } catch {}
  try {
    ({ TelegramUpdate } = require('../../../src/telegram/telegram.update'));
  } catch {}

  const handlerClasses: any[] = [MessageHandler, CommandHandler, CallbackHandler, TelegramUpdate].filter(Boolean);

  handlerClasses.forEach(handlerClass => {
    if (!updatedProviders.some(p => p === handlerClass || (p as any)?.provide === handlerClass)) {
      telegramStubProviders.push({ provide: handlerClass, useValue: {} });
    }
  });

  // DialogRepository token заглушка
  const dialogRepositoryToken = 'DialogRepository';
  if (!updatedProviders.some(p => (p as any)?.provide === dialogRepositoryToken)) {
    telegramStubProviders.push({ provide: dialogRepositoryToken, useValue: {} });
  }

  updatedProviders = [...updatedProviders, ...telegramStubProviders];

  // Добавляем ActionExecutorService, если его еще не добавлен
  const hasActionExecutorService = updatedProviders.some(
    (p: any) => p === ActionExecutorService || p?.provide === ActionExecutorService,
  );

  if (!hasActionExecutorService) {
    updatedProviders.push({
      provide: ActionExecutorService,
      useValue: {
        determineAndPerformAction: jest.fn().mockResolvedValue(null),
        isPerformingAction: jest.fn().mockReturnValue(false),
        getCurrentAction: jest.fn().mockReturnValue(null),
        interruptAction: jest.fn().mockResolvedValue(undefined),
        canExecute: jest.fn().mockImplementation(async (context) => {
          // Имитируем логику проверки возможности выполнения действия
          const resourceCost = context.action.metadata?.resourceCost || 25;
          const actionType = context.action.type;
          
          // Если стоимость отрицательная или нулевая (восстанавливающие действия)
          if (resourceCost <= 0) {
            return true;
          }
          
          // Упрощенная логика для тестов - для действий WORK с высокой стоимостью возвращаем false
          let currentEnergy = 80; // дефолтное значение
          
          // Специальная логика для тестирования - если WORK и resourceCost >= 50, считаем что энергии недостаточно
          if (actionType === 'WORK' && resourceCost >= 50) {
            currentEnergy = 20; // Имитируем низкую энергию
          }
          
          const minEnergyRequired = Math.max(resourceCost, 10);
          
          // Проверяем достаточность энергии
          if (currentEnergy < minEnergyRequired) {
            return false;
          }
          
          // Специальные проверки для конкретных типов действий
          switch (actionType) {
            case 'WORK':
              // Для работы требуется больше энергии
              return currentEnergy >= 50;
            case 'EXERCISE':
              // Для упражнений тоже требуется больше энергии
              return currentEnergy >= 40;
            case 'EXPRESS_EMOTION':
            case 'SEND_MESSAGE':
            case 'SHARE_EMOTION':
            case 'EMOTIONAL_RESPONSE':
              // Эмоциональные и коммуникативные действия требуют меньше энергии
              return currentEnergy >= 10;
            default:
              return true;
          }
        }),
        execute: jest.fn().mockResolvedValue({
          success: true,
          needsImpact: { REST: -20, COMMUNICATION: 15 },
          message: 'Действие успешно выполнено',
        }),
        processActionTrigger: jest.fn().mockResolvedValue({
          success: true,
          message: 'Триггер обработан успешно',
        }),
        getSupportedActionTypes: jest.fn().mockReturnValue(['SEND_MESSAGE', 'WORK', 'REST', 'EXPRESS_EMOTION', 'SHARE_EMOTION', 'EMOTIONAL_RESPONSE']),
        interrupt: jest.fn().mockResolvedValue(undefined),
        createActionWithResources: jest.fn().mockImplementation((characterId, actionType, options = {}) => ({
          type: actionType,
          status: 'pending',
          startTime: new Date(),
          duration: 300,
          description: options.description || `Действие типа ${actionType}`,
          metadata: {
            id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            characterId,
            resourceCost: options.resourceCost || 25,
            successProbability: options.successProbability || 75,
            potentialReward: options.potentialReward || { general_satisfaction: 15 },
            timestamp: new Date(),
          },
        })),
      },
    });
  }

  // Добавляем ActionLifecycleService, если он еще не добавлен
  const hasActionLifecycleService = updatedProviders.some(
    (p: any) => p === ActionLifecycleService || p?.provide === ActionLifecycleService,
  );

  if (!hasActionLifecycleService) {
    updatedProviders.push({
      provide: ActionLifecycleService,
      useValue: {
        registerAction: jest.fn(),
        getAction: jest.fn().mockReturnValue(null),
        getCurrentAction: jest.fn().mockReturnValue(null),
        getSupportedActionTypes: jest.fn().mockReturnValue([]),
        setCurrentAction: jest.fn(),
        completeAction: jest.fn(),
        interruptAction: jest.fn(),
      },
    });
  }

  // Добавляем ActionSchedulerService, если он еще не добавлен
  const hasActionSchedulerService = updatedProviders.some(
    (p: any) => p === ActionSchedulerService || p?.provide === ActionSchedulerService,
  );

  if (!hasActionSchedulerService) {
    updatedProviders.push({
      provide: ActionSchedulerService,
      useValue: {
        scheduleAction: jest.fn(),
        cancelScheduledAction: jest.fn().mockReturnValue(true),
        getScheduledActions: jest.fn().mockReturnValue([]),
      },
    });
  }

  // Добавляем ActionGeneratorService, если он еще не добавлен
  const hasActionGeneratorService = updatedProviders.some(
    (p: any) => p === ActionGeneratorService || p?.provide === ActionGeneratorService,
  );

  if (!hasActionGeneratorService) {
    updatedProviders.push({
      provide: ActionGeneratorService,
      useValue: {
        generateCommunicationAction: jest.fn().mockResolvedValue({
          type: 'SEND_MESSAGE',
          status: 'pending',
          startTime: new Date(),
          duration: 60,
          description: 'Сообщение персонажа',
          metadata: {
            id: 'test-communication-action',
            resourceCost: 20,
            successProbability: 90,
          },
        }),
        generateEmotionalAction: jest.fn().mockResolvedValue({
          type: 'EXPRESS_EMOTION',
          status: 'pending',
          startTime: new Date(),
          duration: 30,
          description: 'Эмоциональное выражение',
          metadata: {
            id: 'test-emotional-action',
            resourceCost: 15,
            successProbability: 85,
          },
        }),
        determineActionFromTrigger: jest.fn().mockResolvedValue({
          type: 'SEND_MESSAGE',
          status: 'pending',
          startTime: new Date(),
          duration: 60,
          description: 'Ответ на сообщение',
          metadata: {
            id: 'test-trigger-action',
            resourceCost: 20,
            successProbability: 90,
            potentialReward: { communication: 15 },
          },
        }),
      },
    });
  }

  // Добавляем ActionResourceService, если он еще не добавлен
  const hasActionResourceService = updatedProviders.some(
    (p: any) => p === ActionResourceService || p?.provide === ActionResourceService,
  );

  if (!hasActionResourceService) {
    updatedProviders.push({
      provide: ActionResourceService,
      useValue: {
        checkResourceAvailability: jest.fn().mockImplementation(async (context) => {
          // Имитируем логику проверки ресурсов на основе реального ActionResourceService
          const resourceCost = context.action.metadata?.resourceCost || 25;
          const actionType = context.action.type;
          
          // Если стоимость отрицательная или нулевая (восстанавливающие действия)
          if (resourceCost <= 0) {
            return true;
          }
          
          // Получаем реальный уровень энергии из контекста или используем дефолтное значение
          let currentEnergy = 80; // дефолтное значение
          
          // Пытаемся получить реальные данные о потребностях из контекста
          if (context.character && context.character.id) {
            try {
              // Ищем MockNeedsService в глобальном контексте тестов
              const needsService = global.__mockNeedsService;
              if (needsService && needsService.getActiveNeeds) {
                const needs = await needsService.getActiveNeeds(context.character.id);
                const restNeed = needs.find(need => need.type === 'REST');
                if (restNeed) {
                  currentEnergy = restNeed.currentValue;
                }
              }
            } catch (error) {
              // Если не удалось получить данные, используем дефолтное значение
              currentEnergy = 80;
            }
          }
          
          const minEnergyRequired = Math.max(resourceCost, 10);
          
          // Проверяем достаточность энергии
          if (currentEnergy < minEnergyRequired) {
            return false;
          }
          
          // Специальные проверки для конкретных типов действий
          switch (actionType) {
            case 'WORK':
              // Для работы требуется больше энергии
              return currentEnergy >= 50;
            case 'EXERCISE':
              // Для упражнений тоже требуется больше энергии
              return currentEnergy >= 40;
            case 'EXPRESS_EMOTION':
            case 'SEND_MESSAGE':
            case 'SHARE_EMOTION':
            case 'EMOTIONAL_RESPONSE':
              // Эмоциональные и коммуникативные действия требуют меньше энергии
              return currentEnergy >= 10;
            default:
              return true;
          }
        }),
        executeActionWithResources: jest.fn().mockResolvedValue({
          success: true,
          message: 'Действие выполнено успешно'
        }),
        createActionWithResources: jest.fn().mockImplementation((characterId, actionType, options = {}) => ({
          type: actionType,
          status: 'pending',
          startTime: new Date(),
          duration: 300,
          description: options.description || `Действие типа ${actionType}`,
          metadata: {
            id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            characterId,
            resourceCost: options.resourceCost || 25,
            successProbability: options.successProbability || 75,
            potentialReward: options.potentialReward || { general_satisfaction: 15 },
            timestamp: new Date(),
          },
        })),
      },
    });
  }

  // Добавляем специализированные сервисы техник
  const techniqueServices = [
    { service: TechniqueHistoryService, name: 'TechniqueHistoryService' },
    { service: TechniqueStrategyService, name: 'TechniqueStrategyService' },
    { service: TechniqueExecutorService, name: 'TechniqueExecutorService' },
  ];

  for (const { service, name } of techniqueServices) {
    const hasService = updatedProviders.some(
      (p: any) => p === service || p?.provide === service,
    );

    if (!hasService) {
      updatedProviders.push({
        provide: service,
        useValue: {
          validateTechnique: jest.fn().mockResolvedValue(true),
          adaptTechnique: jest.fn().mockResolvedValue({}),
          generateResponse: jest.fn().mockResolvedValue('Test response'),
          analyzeEffectiveness: jest.fn().mockResolvedValue({}),
          recordExecution: jest.fn().mockResolvedValue(undefined),
          getStrategy: jest.fn().mockResolvedValue({}),
          executeStrategy: jest.fn().mockResolvedValue({ success: true }),
        },
      });
    }
  }

  return updatedProviders;
}

/**
 * Заменяет TelegrafModule на MockTelegramModule.forRoot() в импортах
 * @param imports массив импортов модулей
 * @returns обновленный массив импортов с замененным TelegrafModule
 */
export function prepareImportsForTesting(
  imports: (Type<any> | DynamicModule)[] = [],
  configType?: TestConfigType,
): (Type<any> | DynamicModule)[] {
  let updatedImports = [...imports];

  // Если в импортах есть TelegrafModule, заменяем его на MockTelegramModule.forRoot()
  if (containsTelegrafModule(updatedImports)) {
    updatedImports = replaceTelegrafModule(updatedImports);
  }

  // Если в импортах есть TelegramModule, заменяем его на MockTelegramModule.forRoot()
  if (containsTelegramModule(updatedImports)) {
    updatedImports = updatedImports.map(mod => {
      const moduleName = (mod as any)?.name || (mod as any)?.module?.name;
      if (moduleName === 'TelegramModule') {
        const { MockTelegramModule } = require('../mocks/mock-telegram.module');
        return MockTelegramModule.forRoot();
      }
      return mod;
    });
  }

  // Заменяем LoggingModule на MockLoggingModule.forRoot()
  updatedImports = updatedImports.map(mod => {
    // Если импорт — DynamicModule с module === LoggingModule
    if ((mod as any)?.module === LoggingModule) {
      return MockLoggingModule.forRoot();
    }
    if (mod === LoggingModule) {
      return MockLoggingModule.forRoot();
    }
    return mod;
  });

  // Заменяем TypeOrmModule на MockTypeOrmModule только для unit тестов, НЕ для интеграционных
  if (configType !== TestConfigType.INTEGRATION) {
    console.log('[prepareImportsForTesting] Обрабатываем импорты для configType:', configType);
    console.log('[prepareImportsForTesting] Импорты до обработки:', updatedImports.map(imp => (imp as any)?.module?.name || (imp as any)?.name || imp));
    
    updatedImports = updatedImports.map(mod => {
      console.log('[prepareImportsForTesting] Обрабатываем модуль:', (mod as any)?.module?.name || (mod as any)?.name || mod);
      console.log('[prepareImportsForTesting] Модуль полностью:', mod);
      console.log('[prepareImportsForTesting] Тип модуля:', typeof mod);
      console.log('[prepareImportsForTesting] Это MockTypeOrmModule?:', (mod as any)?.module?.name === 'MockTypeOrmModule');
      
      // Заменяем TypeOrmModule.forFeature() на MockTypeOrmModule.forFeature()
      if ((mod as any)?.module === TypeOrmModule && (mod as any)?.providers?.length > 0) {
        const { MockTypeOrmModule } = require('../mocks/mock-typeorm.module');
        
        // Если это forRoot - заменяем на MockTypeOrmModule.forRoot()
        if ((mod as any)?.global === true) {
          return MockTypeOrmModule.forRoot();
        }
        
        // Иначе это forFeature - заменяем на MockTypeOrmModule.forFeature()
        // Извлекаем entities из провайдеров
        const entities = [];
        const providers = (mod as any).providers || [];
        
        for (const provider of providers) {
          if (provider && provider.provide && typeof provider.provide === 'string') {
            const match = provider.provide.match(/^(.+)Repository$/);
            if (match) {
              const entityName = match[1];
              // Ищем entity в ALL_TEST_ENTITIES по имени
              const { ALL_TEST_ENTITIES } = require('../entities');
              const entity = ALL_TEST_ENTITIES.find(e => e.name === entityName);
              if (entity) {
                entities.push(entity);
              }
            }
          }
        }
        
        return MockTypeOrmModule.forFeature(entities);
      }
      
      // Заменяем прямые ссылки на TypeOrmModule
      if (mod === TypeOrmModule) {
        const { MockTypeOrmModule } = require('../mocks/mock-typeorm.module');
        return MockTypeOrmModule.forRoot();
      }
      
      return mod;
    });

    // Добавляем MockTypeOrmModule.forRoot() если его еще нет
    const hasMockTypeOrm = updatedImports.some(imp =>
      (imp as any)?.module?.name === 'MockTypeOrmModule' || 
      (imp as any)?.name === 'MockTypeOrmModule'
    );

    if (!hasMockTypeOrm && !updatedImports.some(imp =>
      (imp as any)?.module === TypeOrmModule || imp === TypeOrmModule
    )) {
      const { MockTypeOrmModule } = require('../mocks/mock-typeorm.module');
      updatedImports.push(MockTypeOrmModule.forRoot());
    }
  }

  // Ensure ConfigModule is imported at root for ConfigService availability with базовой тестовой конфигурацией
  if (!updatedImports.some(mod => (mod as any)?.module === ConfigModule || mod === ConfigModule)) {
    updatedImports.push(
      ConfigModule.forRoot({
        isGlobal: true,
        load: [() => ({
          security: {
            apiKey: 'test-api-key',
          },
          telegram: {
            token: 'test-telegram-token',
          },
          logging: {
            rollbar: {
              enabled: false,
              accessToken: '',
              environment: 'test',
              captureUncaught: false,
              captureUnhandledRejections: false,
            },
          },
          llm: {
            providers: [],
          },
        })],
      }) as unknown as DynamicModule,
    );
  }

  // Ensure TelegrafTokenMockModule is imported to предоставлять TELEGRAF_TOKEN глобально
  const { TelegrafTokenMockModule } = require('../mocks/telegraf-token.module');
  if (!updatedImports.some(mod => (mod as any)?.module === TelegrafTokenMockModule || mod === TelegrafTokenMockModule)) {
    updatedImports.push(TelegrafTokenMockModule);
  }

  // Всегда добавляем MockTelegramModule.forRoot(), если он ещё не добавлен напрямую
  const { MockTelegramModule } = require('../mocks/mock-telegram.module');
  const hasMockTelegramModule = updatedImports.some(
    mod => (mod as any)?.module === MockTelegramModule || mod === MockTelegramModule,
  );
  if (!hasMockTelegramModule) {
    updatedImports.push(MockTelegramModule.forRoot());
  }

  // Для интеграционных тестов добавляем настоящий TypeOrmModule.forRoot() если его нет
  if (configType === TestConfigType.INTEGRATION) {
    const hasTypeOrmModule = updatedImports.some(imp =>
      (imp as any)?.module === TypeOrmModule || imp === TypeOrmModule
    );

    if (!hasTypeOrmModule) {
      // Добавляем настоящий TypeOrmModule.forRoot() для интеграционных тестов
      updatedImports.push(TypeOrmModule.forRoot({
        type: 'postgres',
        host: process.env.TEST_DB_HOST || 'localhost',
        port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
        username: process.env.TEST_DB_USERNAME || 'test_user',
        password: process.env.TEST_DB_PASSWORD || 'test_password',
        database: process.env.TEST_DB_NAME || 'nexus_test',
        synchronize: true,
        dropSchema: true,
        logging: false,
        entities: ['src/**/*.entity{.ts,.js}'],
        retryAttempts: 3,
        retryDelay: 2000,
        extra: {
          max: 1,
          min: 1,
          connectionTimeoutMillis: 5000,
          idleTimeoutMillis: 10000,
          acquireTimeoutMillis: 5000,
        },
      }));
    }
  }

  // Ensure MockDialogRepositoryModule imported to satisfy DialogRepository DI только для НЕ интеграционных тестов
  if (configType !== TestConfigType.INTEGRATION && 
      !updatedImports.some(mod => (mod as any)?.module === MockDialogRepositoryModule || mod === MockDialogRepositoryModule)) {
    updatedImports.push(MockDialogRepositoryModule);
  }

  return updatedImports;
}

/**
 * Объект, содержащий функции для управления тестовыми конфигурациями
 */
export const TestConfigurations = {
  getDialogTestConfig,
  addMockUserServiceToProviders,
  mockUserService,
  containsDialogModule,
  requiredMocksAdder: (
    imports: (Type<any> | DynamicModule)[] = [],
    providers: Provider[] = [],
  ): Provider[] => {
    return requiredMocksAdder(imports, providers);
  },
  addConfigServiceProvider,
  addDataSourceProvider,
  addTelegrafTokenProvider,
  prepareImportsForTesting,
  addLoggingMocks: (providers: Provider[] = []): Provider[] => {
    const config = { providers };
    const updatedConfig = addLoggingMocks(config);
    return updatedConfig.providers;
  },
};

/**
 * Добавляет TelegrafTokenProvider в провайдеры для тестов Telegram
 * @param providers массив провайдеров
 * @returns обновленный массив провайдеров с добавленным TelegrafTokenProvider
 */
export function addTelegrafTokenProvider(providers: any[] = []): any[] {
  const hasTokenProvider = providers.some(
    (provider: any) =>
      provider === TelegrafTokenProvider ||
      (provider?.provide === (TelegrafTokenProvider as any).provide &&
        provider?.useValue === (TelegrafTokenProvider as any).useValue),
  );

  const hasToken = providers.some((provider: any) => provider?.provide === TELEGRAF_TOKEN);

  const updatedProviders = [...providers];

  if (!hasTokenProvider) {
    updatedProviders.push(TelegrafTokenProvider);
  }

  if (!hasToken) {
    updatedProviders.push({
      provide: TELEGRAF_TOKEN,
      useValue: 'test-telegram-token',
    });
  }

  // Добавляем ActionExecutorService, если его еще нет
  const hasActionExecutorService = updatedProviders.some(
    (p: any) => p?.provide === ActionExecutorService || (p as any)?.constructor?.name === "ActionExecutorService",
  );

  if (!hasActionExecutorService) {
    updatedProviders.push({
      provide: ActionExecutorService,
      useValue: {
        determineAndPerformAction: jest.fn(),
        isPerformingAction: jest.fn(),
        getCurrentAction: jest.fn(),
        interruptAction: jest.fn(),
        canExecute: jest.fn(),
        execute: jest.fn(),
        processActionTrigger: jest.fn(),
      },
    });
  }

  return updatedProviders;
}

/**
 * Добавляет ConfigServiceProvider в провайдеры
 */
export function addConfigServiceProvider(providers: any[]): any[] {
  const hasConfigServiceProvider = providers.some(
    p => p === ConfigService || p?.provide === ConfigService || p?.provide === 'ConfigService',
  );

  if (hasConfigServiceProvider) {
    return providers;
  }

  return [
    ...providers,
    { provide: ConfigService, useValue: mockConfigService },
    { provide: 'ConfigService', useValue: mockConfigService },
  ];
}

/**
 * Добавляет DATA_SOURCE провайдер для FixtureManager
 */
export function addDataSourceProvider(providers: any[] = []): any[] {
  const dataSourceExists = providers.some((provider: any) => provider?.provide === 'DATA_SOURCE');

  if (!dataSourceExists) {
    providers.push({
      provide: 'DATA_SOURCE',
      useFactory: async () => {
        const { createTestDataSource } = require('../utils/data-source');
        const dataSource = await createTestDataSource();
        if (!dataSource.isInitialized) {
        await dataSource.initialize();
        }
        return dataSource;
      },
    });
    providers.push({
      provide: DataSource,
      useExisting: 'DATA_SOURCE',
    });
    providers.push({
      provide: 'DataSource',
      useExisting: 'DATA_SOURCE',
    });
  }

  return providers;
}
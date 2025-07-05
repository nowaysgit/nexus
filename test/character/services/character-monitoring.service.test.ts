import { createTest, createTestSuite, TestConfigType } from '../../../lib/tester';
import { CharacterMonitoringService } from '../../../src/character/services/core/character-monitoring.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LogService } from '../../../src/logging/log.service';

// Создаем полный мок LogService
const createLogServiceMock = () => {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn().mockReturnThis(),
  };
};

createTestSuite('CharacterMonitoringService Tests', () => {
  createTest(
    {
      name: 'должен быть определен',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            on: jest.fn(),
            removeListener: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);
      expect(service).toBeDefined();
    },
  );

  createTest(
    {
      name: 'должен инициализироваться с пустыми метриками',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      await service.onModuleInit();

      // Проверяем что сервис не упал при ошибке инициализации
      expect(service).toBeDefined();
      expect(service.getAllCharacterMetrics()).toEqual([]);
    },
  );

  createTest(
    {
      name: 'должен инициализировать метрики для существующих персонажей',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn().mockResolvedValue([
              { id: 1, name: 'Character 1' },
              { id: 2, name: 'Character 2' },
            ]),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      await service.onModuleInit();

      const metrics = service.getAllCharacterMetrics();
      expect(metrics).toHaveLength(2);
      expect(metrics[0].characterId).toBe(1);
      expect(metrics[1].characterId).toBe(2);
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки при инициализации метрик',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn().mockRejectedValue(new Error('Database error')),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      // Запускаем инициализацию и ждем завершения
      await service.onModuleInit();

      // Проверяем что сервис не упал при ошибке инициализации
      expect(service).toBeDefined();
      expect(service.getAllCharacterMetrics()).toEqual([]);
    },
  );

  createTest(
    {
      name: 'должен обновлять метрики активности персонажа',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      const payload = {
        characterId: 1,
        activityType: 'message',
        responseTime: 150,
        data: { messageId: 'msg-1' },
      };

      await service.handleCharacterActivity(payload);

      const metrics = service.getCharacterMetrics(1);
      expect(metrics).toBeDefined();
      expect(metrics.characterId).toBe(1);
      expect(metrics.messageCount).toBe(1);
      expect(metrics.averageResponseTime).toBe(150);
      expect(metrics.lastActivity).toBeInstanceOf(Date);
    },
  );

  createTest(
    {
      name: 'должен правильно рассчитывать среднее время ответа',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      const payload1 = {
        characterId: 1,
        activityType: 'message',
        responseTime: 100,
      };
      const payload2 = {
        characterId: 1,
        activityType: 'message',
        responseTime: 200,
      };

      await service.handleCharacterActivity(payload1);
      await service.handleCharacterActivity(payload2);

      const metrics = service.getCharacterMetrics(1);
      expect(metrics.messageCount).toBe(2);
      expect(metrics.averageResponseTime).toBe(150); // (100 + 200) / 2
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки при обновлении активности',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      const invalidPayload = null;

      await service.handleCharacterActivity(invalidPayload);

      // Проверяем что сервис не упал при неверных данных
      expect(service).toBeDefined();
    },
  );

  createTest(
    {
      name: 'должен обновлять счетчик изменений эмоционального состояния',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      const payload = {
        characterId: 1,
        oldState: { primary: 'neutral' },
        newState: { primary: 'happy' },
        trigger: 'positive_message',
      };

      await service.handleEmotionalStateChanged(payload);

      const metrics = service.getCharacterMetrics(1);
      expect(metrics.emotionalStateChanges).toBe(1);

      const systemMetrics = service.getSystemMetrics();
      expect(systemMetrics.totalEmotionalStateChanges).toBe(1);
    },
  );

  createTest(
    {
      name: 'должен добавлять событие в буфер при изменении эмоций',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      const payload = {
        characterId: 1,
        oldState: { primary: 'neutral' },
        newState: { primary: 'happy' },
        trigger: 'positive_message',
      };

      await service.handleEmotionalStateChanged(payload);

      const events = service.getCharacterEvents(1);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('emotional_change');
      expect(events[0].data.oldEmotion).toBe('neutral');
      expect(events[0].data.newEmotion).toBe('happy');
    },
  );

  createTest(
    {
      name: 'должен обновлять счетчик выполнения мотиваций',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      const payload = {
        characterId: 1,
        motivationId: 'motivation-1',
        success: true,
        executionTime: 250,
      };

      await service.handleMotivationExecuted(payload);

      const metrics = service.getCharacterMetrics(1);
      expect(metrics.motivationExecutions).toBe(1);

      const systemMetrics = service.getSystemMetrics();
      expect(systemMetrics.totalMotivationExecutions).toBe(1);
    },
  );

  createTest(
    {
      name: 'должен обрабатывать неуспешные выполнения мотиваций',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      const payload = {
        characterId: 1,
        motivationId: 'motivation-1',
        success: false,
      };

      await service.handleMotivationExecuted(payload);

      const events = service.getCharacterEvents(1);
      expect(events[0].success).toBe(false);
    },
  );

  createTest(
    {
      name: 'должен обновлять метрики планировщика',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      const payload = {
        characterId: 1,
        taskType: 'needs_update',
        executionTime: 50,
        success: true,
      };

      await service.handleSchedulerExecution(payload);

      const metrics = service.getCharacterMetrics(1);
      expect(metrics.schedulerExecutions).toBe(1);
      expect(metrics.lastSchedulerRun).toBeInstanceOf(Date);

      const systemMetrics = service.getSystemMetrics();
      expect(systemMetrics.schedulerPerformance.averageExecutionTime).toBe(50);
      expect(systemMetrics.schedulerPerformance.successRate).toBe(100);
    },
  );

  createTest(
    {
      name: 'должен правильно рассчитывать процент успешности планировщика',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      const successPayload = {
        taskType: 'needs_update',
        executionTime: 50,
        success: true,
      };
      const failPayload = {
        taskType: 'motivation_check',
        executionTime: 75,
        success: false,
      };

      await service.handleSchedulerExecution(successPayload);
      await service.handleSchedulerExecution(failPayload);

      const systemMetrics = service.getSystemMetrics();
      expect(systemMetrics.schedulerPerformance.successRate).toBe(50); // 1 из 2 успешных
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки системы',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      const payload = {
        characterId: 1,
        errorType: 'database_error',
        errorMessage: 'Database connection failed',
        context: { service: 'CharacterSchedulerService' },
      };

      await service.handleError(payload);

      const systemMetrics = service.getSystemMetrics();
      expect(systemMetrics.totalErrors).toBe(1);

      const events = service.getCharacterEvents(1);
      expect(events[0].type).toBe('error');
      expect(events[0].data.errorMessage).toBe('Database connection failed');
    },
  );

  createTest(
    {
      name: 'должен генерировать часовой отчет',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      // Добавляем некоторые метрики
      await service.handleCharacterActivity({
        characterId: 1,
        activityType: 'message',
        responseTime: 100,
      });

      await service.generateHourlyReport();

      // Проверяем что отчет был сгенерирован без ошибок
      expect(service).toBeDefined();
    },
  );

  createTest(
    {
      name: 'должен возвращать события персонажа',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      // Добавляем событие
      await service.handleCharacterActivity({
        characterId: 1,
        activityType: 'message',
        responseTime: 100,
      });

      const events = service.getCharacterEvents(1);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('character_activity');
      expect(events[0].characterId).toBe(1);
    },
  );

  createTest(
    {
      name: 'должен обрабатывать завершение модуля',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: CharacterMonitoringService,
          useClass: CharacterMonitoringService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(CharacterMonitoringService);

      await service.onModuleDestroy();

      // Проверяем что сервис корректно завершился
      expect(service).toBeDefined();
    },
  );
});

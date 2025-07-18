import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CharacterMonitoringService,
  CharacterMetrics,
  MonitoringEvent,
} from '../../../src/character/services/core/character-monitoring.service';
import { Character } from '../../../src/character/entities/character.entity';
import { LogService } from '../../../src/logging/log.service';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';

describe('CharacterMonitoringService', () => {
  let service: CharacterMonitoringService;
  let characterRepository: jest.Mocked<Repository<Character>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let logService: jest.Mocked<LogService>;

  // Тестовые данные
  const mockCharacters = [
    {
      id: 1,
      name: 'Test Character 1',
      archetype: CharacterArchetype.HERO,
    } as Character,
    {
      id: 2,
      name: 'Test Character 2',
      archetype: CharacterArchetype.MENTOR,
    } as Character,
  ];

  beforeEach(async () => {
    // Создаем моки для всех зависимостей
    const mockCharacterRepository = {
      find: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockLogService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      setContext: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterMonitoringService,
        {
          provide: getRepositoryToken(Character),
          useValue: mockCharacterRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    }).compile();

    service = module.get<CharacterMonitoringService>(CharacterMonitoringService);
    characterRepository = module.get(getRepositoryToken(Character));
    eventEmitter = module.get(EventEmitter2);
    logService = module.get(LogService);

    // Сбрасываем метрики перед каждым тестом
    service.resetMetrics();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('должен инициализировать метрики для существующих персонажей', async () => {
      characterRepository.find.mockResolvedValue(mockCharacters);

      await service.onModuleInit();

      expect(characterRepository.find).toHaveBeenCalledTimes(1);
      expect(logService.info).toHaveBeenCalledWith(
        'Инициализация сервиса мониторинга персонажей',
        undefined,
      );
      expect(logService.info).toHaveBeenCalledWith(
        `Инициализированы метрики для ${mockCharacters.length} персонажей`,
        undefined,
      );
      expect(logService.info).toHaveBeenCalledWith(
        'Сервис мониторинга персонажей инициализирован',
        undefined,
      );
    });

    it('должен обрабатывать ошибки при инициализации', async () => {
      const error = new Error('Database error');
      characterRepository.find.mockRejectedValue(error);

      await service.onModuleInit();

      expect(logService.error).toHaveBeenCalledWith('Ошибка инициализации метрик персонажей', {
        error: 'Database error',
      });
    });
  });

  describe('handleCharacterActivity', () => {
    it('должен обновлять метрики активности персонажа', async () => {
      const payload = {
        characterId: 1,
        activityType: 'message_sent',
        responseTime: 150,
        data: { messageId: 123 },
      };

      await service.handleCharacterActivity(payload);

      const metrics = service.getCharacterMetrics(1);
      expect(metrics).toBeDefined();
      expect(metrics.characterId).toBe(1);
      expect(metrics.messageCount).toBe(1);
      expect(metrics.averageResponseTime).toBe(150);
      expect(metrics.lastActivity).toBeInstanceOf(Date);

      expect(logService.debug).toHaveBeenCalledWith(
        'Обновлена активность персонажа 1',
        expect.objectContaining({
          activityType: 'message_sent',
          messageCount: 1,
          averageResponseTime: 150,
        }),
      );
    });

    it('должен правильно рассчитывать среднее время ответа', async () => {
      const payload1 = {
        characterId: 1,
        activityType: 'message_sent',
        responseTime: 100,
      };

      const payload2 = {
        characterId: 1,
        activityType: 'message_sent',
        responseTime: 200,
      };

      await service.handleCharacterActivity(payload1);
      await service.handleCharacterActivity(payload2);

      const metrics = service.getCharacterMetrics(1);
      expect(metrics.messageCount).toBe(2);
      expect(metrics.averageResponseTime).toBe(150); // (100 + 200) / 2
    });

    it('должен обрабатывать активность без времени ответа', async () => {
      const payload = {
        characterId: 1,
        activityType: 'status_update',
      };

      await service.handleCharacterActivity(payload);

      const metrics = service.getCharacterMetrics(1);
      expect(metrics).toBeDefined();
      expect(metrics.messageCount).toBe(1);
      expect(metrics.averageResponseTime).toBe(0);
    });

    it('должен обрабатывать ошибки при обновлении активности', async () => {
      const payload = {
        characterId: 1,
        activityType: 'message_sent',
      };

      // Мокируем ошибку в методе addEvent
      const originalAddEvent = (service as any).addEvent;
      (service as any).addEvent = jest.fn().mockImplementation(() => {
        throw new Error('Event buffer error');
      });

      await service.handleCharacterActivity(payload);

      expect(logService.error).toHaveBeenCalledWith(
        'Ошибка обработки активности персонажа',
        expect.objectContaining({
          payload,
          error: 'Event buffer error',
        }),
      );

      // Восстанавливаем оригинальный метод
      (service as any).addEvent = originalAddEvent;
    });
  });

  describe('handleEmotionalStateChanged', () => {
    it('должен обновлять метрики изменения эмоционального состояния', async () => {
      const payload = {
        characterId: 1,
        oldState: { primary: 'радость' },
        newState: { primary: 'грусть' },
        trigger: 'плохие новости',
      };

      await service.handleEmotionalStateChanged(payload);

      const metrics = service.getCharacterMetrics(1);
      expect(metrics.emotionalStateChanges).toBe(1);

      const systemMetrics = service.getSystemMetrics();
      expect(systemMetrics.totalEmotionalStateChanges).toBe(1);

      expect(logService.debug).toHaveBeenCalledWith(
        'Зафиксировано изменение эмоционального состояния персонажа 1',
        expect.objectContaining({
          oldEmotion: 'радость',
          newEmotion: 'грусть',
          totalChanges: 1,
        }),
      );
    });

    it('должен обрабатывать ошибки при изменении эмоционального состояния', async () => {
      const payload = {
        characterId: 1,
        oldState: { primary: 'радость' },
        newState: { primary: 'грусть' },
        trigger: 'плохие новости',
      };

      // Мокируем ошибку
      const originalAddEvent = (service as any).addEvent;
      (service as any).addEvent = jest.fn().mockImplementation(() => {
        throw new Error('Event buffer error');
      });

      await service.handleEmotionalStateChanged(payload);

      expect(logService.error).toHaveBeenCalledWith(
        'Ошибка обработки изменения эмоционального состояния',
        expect.objectContaining({
          payload,
          error: 'Event buffer error',
        }),
      );

      // Восстанавливаем оригинальный метод
      (service as any).addEvent = originalAddEvent;
    });
  });

  describe('handleSchedulerExecution', () => {
    it('должен обновлять метрики выполнения планировщика', async () => {
      const payload = {
        characterId: 1,
        taskType: 'need_update',
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

      expect(logService.debug).toHaveBeenCalledWith(
        'Зафиксировано выполнение планировщика',
        expect.objectContaining({
          taskType: 'need_update',
          executionTime: 50,
          success: true,
          characterId: 1,
        }),
      );
    });

    it('должен обрабатывать неуспешное выполнение планировщика', async () => {
      const payload = {
        characterId: 1,
        taskType: 'motivation_check',
        executionTime: 75,
        success: false,
        error: 'Timeout error',
      };

      await service.handleSchedulerExecution(payload);

      const systemMetrics = service.getSystemMetrics();
      expect(systemMetrics.schedulerPerformance.successRate).toBe(0);
    });

    it('должен обрабатывать выполнение планировщика без characterId', async () => {
      const payload = {
        taskType: 'system_cleanup',
        executionTime: 25,
        success: true,
      };

      await service.handleSchedulerExecution(payload);

      const systemMetrics = service.getSystemMetrics();
      expect(systemMetrics.schedulerPerformance.averageExecutionTime).toBe(25);
    });

    it('должен ограничивать размер массива времен выполнения', async () => {
      // Добавляем более 100 выполнений
      for (let i = 0; i < 105; i++) {
        await service.handleSchedulerExecution({
          taskType: 'test_task',
          executionTime: i,
          success: true,
        });
      }

      const systemMetrics = service.getSystemMetrics();
      // Проверяем, что среднее время рассчитывается только для последних 100 записей
      expect(systemMetrics.schedulerPerformance.averageExecutionTime).toBeGreaterThan(50);
    });
  });

  describe('handleError', () => {
    it('должен обновлять метрики ошибок', async () => {
      const payload = {
        characterId: 1,
        errorType: 'validation_error',
        errorMessage: 'Invalid input data',
        context: { field: 'name' },
      };

      await service.handleError(payload);

      const metrics = service.getCharacterMetrics(1);
      expect(metrics.errorCount).toBe(1);

      const systemMetrics = service.getSystemMetrics();
      expect(systemMetrics.totalErrors).toBe(1);

      expect(logService.warn).toHaveBeenCalledWith(
        'Зафиксирована ошибка',
        expect.objectContaining({
          characterId: 1,
          errorType: 'validation_error',
          errorMessage: 'Invalid input data',
        }),
      );
    });

    it('должен обрабатывать ошибки без characterId', async () => {
      const payload = {
        errorType: 'system_error',
        errorMessage: 'Database connection failed',
      };

      await service.handleError(payload);

      const systemMetrics = service.getSystemMetrics();
      expect(systemMetrics.totalErrors).toBe(1);
    });
  });

  describe('getCharacterMetrics', () => {
    it('должен возвращать метрики персонажа', () => {
      // Сначала создаем активность для персонажа
      service.handleCharacterActivity({
        characterId: 1,
        activityType: 'test',
      });

      const metrics = service.getCharacterMetrics(1);
      expect(metrics).toBeDefined();
      expect(metrics.characterId).toBe(1);
    });

    it('должен возвращать null для несуществующего персонажа', () => {
      const metrics = service.getCharacterMetrics(999);
      expect(metrics).toBeNull();
    });
  });

  describe('getAllCharacterMetrics', () => {
    it('должен возвращать все метрики персонажей', async () => {
      await service.handleCharacterActivity({
        characterId: 1,
        activityType: 'test1',
      });

      await service.handleCharacterActivity({
        characterId: 2,
        activityType: 'test2',
      });

      const allMetrics = service.getAllCharacterMetrics();
      expect(allMetrics).toHaveLength(2);
      expect(allMetrics.map(m => m.characterId)).toEqual(expect.arrayContaining([1, 2]));
    });

    it('должен возвращать пустой массив, если нет метрик', () => {
      const allMetrics = service.getAllCharacterMetrics();
      expect(allMetrics).toHaveLength(0);
    });
  });

  describe('getSystemMetrics', () => {
    beforeEach(async () => {
      // Создаем базовые метрики для тестов
      await service.handleCharacterActivity({
        characterId: 1,
        activityType: 'test',
        responseTime: 100,
      });

      await service.handleCharacterActivity({
        characterId: 2,
        activityType: 'test',
        responseTime: 200,
      });

      await service.handleEmotionalStateChanged({
        characterId: 1,
        oldState: { primary: 'радость' },
        newState: { primary: 'грусть' },
        trigger: 'test',
      });

      await service.handleSchedulerExecution({
        characterId: 1,
        taskType: 'test',
        executionTime: 50,
        success: true,
      });

      await service.handleError({
        characterId: 1,
        errorType: 'test_error',
        errorMessage: 'Test error',
      });
    });

    it('должен возвращать корректные системные метрики', () => {
      const systemMetrics = service.getSystemMetrics();

      expect(systemMetrics.totalCharacters).toBe(2);
      expect(systemMetrics.averageMessageCount).toBe(1); // (1 + 1) / 2
      expect(systemMetrics.totalEmotionalStateChanges).toBe(1);
      expect(systemMetrics.totalErrors).toBe(1);
      expect(systemMetrics.systemUptime).toBeGreaterThanOrEqual(0);
      expect(systemMetrics.memoryUsage).toBeDefined();
      expect(systemMetrics.memoryUsage.percentage).toBeGreaterThan(0);
      expect(systemMetrics.schedulerPerformance).toBeDefined();
      expect(systemMetrics.schedulerPerformance.averageExecutionTime).toBe(50);
      expect(systemMetrics.schedulerPerformance.successRate).toBe(100);
    });

    it('должен правильно определять активных персонажей', () => {
      const systemMetrics = service.getSystemMetrics();

      // Все персонажи должны быть активными, так как у них была недавняя активность
      expect(systemMetrics.activeCharacters).toBe(2);
      expect(systemMetrics.inactiveCharacters).toBe(0);
    });
  });

  describe('generateHourlyReport', () => {
    it('должен генерировать часовой отчет', async () => {
      await service.handleCharacterActivity({
        characterId: 1,
        activityType: 'test',
      });

      await service.generateHourlyReport();

      expect(logService.info).toHaveBeenCalledWith(
        'Часовой отчет мониторинга',
        expect.objectContaining({
          totalCharacters: expect.any(Number),
          activeCharacters: expect.any(Number),
          totalMessages: expect.any(Number),
          emotionalChanges: expect.any(Number),
          motivationExecutions: expect.any(Number),
          errors: expect.any(Number),
          schedulerSuccessRate: expect.any(String),
          memoryUsage: expect.any(String),
          uptime: expect.any(String),
        }),
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'monitoring.hourly_report',
        expect.objectContaining({
          systemMetrics: expect.any(Object),
          characterMetrics: expect.any(Array),
          timestamp: expect.any(Date),
        }),
      );
    });
  });

  describe('resetMetrics', () => {
    it('должен сбрасывать все метрики', async () => {
      // Создаем некоторые метрики
      await service.handleCharacterActivity({
        characterId: 1,
        activityType: 'test',
      });

      await service.handleEmotionalStateChanged({
        characterId: 1,
        oldState: { primary: 'радость' },
        newState: { primary: 'грусть' },
        trigger: 'test',
      });

      // Проверяем, что метрики есть
      expect(service.getCharacterMetrics(1)).toBeDefined();
      expect(service.getSystemMetrics().totalEmotionalStateChanges).toBe(1);

      // Сбрасываем метрики
      service.resetMetrics();

      // Проверяем, что метрики сброшены
      expect(service.getCharacterMetrics(1)).toBeNull();
      expect(service.getSystemMetrics().totalEmotionalStateChanges).toBe(0);
      expect(service.getAllCharacterMetrics()).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('должен корректно обрабатывать ошибки в withErrorHandling', async () => {
      // Мокируем ошибку в getSystemMetrics
      const originalGetSystemMetrics = service.getSystemMetrics;
      service.getSystemMetrics = jest.fn().mockImplementation(() => {
        throw new Error('System metrics error');
      });

      // withErrorHandling перехватывает ошибку, поэтому метод не должен выбрасывать исключение
      await expect(service.generateHourlyReport()).rejects.toThrow('System metrics error');

      expect(logService.error).toHaveBeenCalledWith(
        'Ошибка при выполнении операции "генерации часового отчета мониторинга"',
        expect.objectContaining({
          operation: 'генерации часового отчета мониторинга',
          error: 'System metrics error',
        }),
      );

      // Восстанавливаем оригинальный метод
      service.getSystemMetrics = originalGetSystemMetrics;
    });
  });
});

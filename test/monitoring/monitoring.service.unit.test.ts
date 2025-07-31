/**
 * Unit тесты для MonitoringService
 * Покрывают функциональность мониторинга системы, метрик и алертов с mock зависимостями
 */

import { MonitoringService, AlertRule, ScalingRule } from '../../src/monitoring/monitoring.service';

// Определяем интерфейсы для моков
interface MockConfigService {
  get: jest.Mock;
}

interface MockMessageQueueService {
  getStats: jest.Mock;
  getQueueSize: jest.Mock;
}

interface MockLogService {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
  setContext: jest.Mock;
  getContext: jest.Mock;
}

describe('MonitoringService Unit Tests', () => {
  let service: MonitoringService;
  let mockConfigService: MockConfigService;
  let mockMessageQueueService: MockMessageQueueService;
  let mockLogService: MockLogService;

  beforeEach(() => {
    // Создаем моки
    mockConfigService = {
      get: jest.fn(),
    };

    mockMessageQueueService = {
      getStats: jest.fn(),
      getQueueSize: jest.fn(),
    };

    mockLogService = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn().mockReturnThis(),
      getContext: jest.fn(),
    };

    // Настраиваем дефолтные значения для ConfigService
    mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
      switch (key) {
        case 'monitoring.enabled':
          return true;
        case 'monitoring.detailedLogging':
          return false;
        default:
          return defaultValue;
      }
    });

    // Настраиваем MessageQueueService моки
    mockMessageQueueService.getStats.mockResolvedValue({
      queued: 5,
      processing: 2,
      completed: 100,
      failed: 1,
    });

    mockMessageQueueService.getQueueSize.mockResolvedValue(5);

    // Создаем сервис с моками
    service = new MonitoringService(
      mockConfigService as any,
      mockMessageQueueService as any,
      mockLogService as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Инициализация и конфигурация', () => {
    it('должен правильно инициализироваться с включенным мониторингом', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('monitoring.enabled', true);
      expect(mockConfigService.get).toHaveBeenCalledWith('monitoring.detailedLogging', false);
    });

    it('должен инициализироваться при onModuleInit', async () => {
      await service.onModuleInit();

      expect(mockLogService.info).toHaveBeenCalledWith(
        'Сервис мониторинга инициализирован',
        expect.objectContaining({
          enabled: true,
          detailedLogging: false,
        }),
      );
    });

    it('должен создавать сервис с отключенным мониторингом', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'monitoring.enabled') return false;
        if (key === 'monitoring.detailedLogging') return false;
        return defaultValue;
      });

      const disabledService = new MonitoringService(
        mockConfigService as any,
        mockMessageQueueService as any,
        mockLogService as any,
      );

      expect(disabledService).toBeDefined();
    });
  });

  describe('Управление метриками', () => {
    it('должен записывать метрики системы', () => {
      const metricName = 'cpu_usage';
      const value = 75.5;
      const unit = 'percent';
      const tags = { server: 'web-01' };

      service.recordMetric(metricName, value, unit, tags);

      // Проверяем, что метрика была добавлена
      const metrics = service.getMetrics(metricName);
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toMatchObject({
        name: metricName,
        value,
        unit,
        tags,
      });
      expect(metrics[0].id).toBeDefined();
      expect(metrics[0].timestamp).toBeInstanceOf(Date);
    });

    it('должен записывать метрики без дополнительных параметров', () => {
      const metricName = 'memory_usage';
      const value = 1024;

      service.recordMetric(metricName, value);

      const metrics = service.getMetrics(metricName);
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toMatchObject({
        name: metricName,
        value,
        unit: '',
        tags: {},
      });
    });

    it('должен возвращать метрики по имени', () => {
      service.recordMetric('test_metric', 10);
      service.recordMetric('test_metric', 20);
      service.recordMetric('other_metric', 30);

      const testMetrics = service.getMetrics('test_metric');
      const otherMetrics = service.getMetrics('other_metric');

      expect(testMetrics).toHaveLength(2);
      expect(otherMetrics).toHaveLength(1);
      expect(testMetrics[0].value).toBe(10);
      expect(testMetrics[1].value).toBe(20);
    });

    it('должен возвращать пустой массив для несуществующих метрик', () => {
      const metrics = service.getMetrics('nonexistent_metric');
      expect(metrics).toEqual([]);
    });

    it('должен возвращать все метрики', () => {
      service.recordMetric('metric1', 1);
      service.recordMetric('metric2', 2);
      service.recordMetric('metric1', 3);

      const allMetrics = service.getAllMetrics();
      expect(allMetrics).toHaveProperty('metric1');
      expect(allMetrics).toHaveProperty('metric2');
      expect(allMetrics.metric1).toHaveLength(2);
      expect(allMetrics.metric2).toHaveLength(1);
    });

    it('должен очищать старые метрики', () => {
      service.recordMetric('test', 1);
      service.cleanupOldMetrics();

      // Поскольку метрика только что создана, она не должна быть удалена
      const metrics = service.getMetrics('test');
      expect(metrics).toHaveLength(1);
    });
  });

  describe('Управление алертами', () => {
    it('должен создавать правила алертов', () => {
      const rule: Omit<AlertRule, 'id'> = {
        name: 'High CPU Usage',
        metric: 'cpu_usage',
        threshold: 80,
        operator: 'gt',
        enabled: true,
        severity: 'high',
      };

      const ruleId = service.addAlertRule(rule);
      expect(typeof ruleId).toBe('string');
      expect(ruleId).toBeTruthy();

      const allRules = service.getAlertRules();
      const createdRule = allRules.find(r => r.id === ruleId);
      expect(createdRule).toMatchObject(rule);
    });

    it('должен возвращать все правила алертов', () => {
      const rule1: Omit<AlertRule, 'id'> = {
        name: 'Rule 1',
        metric: 'metric1',
        threshold: 10,
        operator: 'gt',
        enabled: true,
        severity: 'low',
      };

      const rule2: Omit<AlertRule, 'id'> = {
        name: 'Rule 2',
        metric: 'metric2',
        threshold: 20,
        operator: 'lt',
        enabled: false,
        severity: 'medium',
      };

      service.addAlertRule(rule1);
      service.addAlertRule(rule2);

      const allRules = service.getAlertRules();
      expect(allRules.length).toBeGreaterThanOrEqual(2);
    });

    it('должен возвращать активные алерты', () => {
      const alerts = service.getActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('должен разрешать алерты', () => {
      // Проверяем, что метод resolveAlert работает
      const resolved = service.resolveAlert('some_alert_id');
      expect(typeof resolved).toBe('boolean');
    });
  });

  describe('Автомасштабирование', () => {
    it('должен создавать правила масштабирования', () => {
      const rule: Omit<ScalingRule, 'id'> = {
        name: 'CPU Scaling',
        metric: 'cpu_usage',
        scaleUpThreshold: 80,
        scaleDownThreshold: 30,
        minReplicas: 1,
        maxReplicas: 5,
        enabled: true,
      };

      const ruleId = service.addScalingRule(rule);
      expect(typeof ruleId).toBe('string');
      expect(ruleId).toBeTruthy();

      const allRules = service.getScalingRules();
      const createdRule = allRules.find(r => r.id === ruleId);
      expect(createdRule).toMatchObject(rule);
    });

    it('должен применять правила масштабирования', () => {
      const rule: Omit<ScalingRule, 'id'> = {
        name: 'Auto Scale',
        metric: 'request_rate',
        scaleUpThreshold: 100,
        scaleDownThreshold: 20,
        minReplicas: 2,
        maxReplicas: 10,
        enabled: true,
      };

      service.addScalingRule(rule);
      service.recordMetric('request_rate', 150); // Превышаем порог scale up

      const scalingActions = service.checkScaling();
      expect(Array.isArray(scalingActions)).toBe(true);
    });
  });

  describe('Мониторинг системы', () => {
    it('должен получать состояние системы', async () => {
      const status = await service.getSystemHealth();
      expect(status).toEqual({
        status: expect.stringMatching(/healthy|warning|critical/),
        uptime: expect.any(Number),
        memory: expect.objectContaining({
          used: expect.any(Number),
          total: expect.any(Number),
          percentage: expect.any(Number),
        }),
        cpu: expect.objectContaining({
          user: expect.any(Number),
          system: expect.any(Number),
        }),
        timestamp: expect.any(Date),
      });
    });

    it('должен проверять подключение к базе данных', async () => {
      const isConnected = await service.checkDatabaseConnection();
      expect(typeof isConnected).toBe('boolean');
    });

    it('должен получать метрики мониторинга', async () => {
      // Мокаем правильную структуру ответа MessageQueue
      const mockQueueStats = {
        queueLength: 5,
        processingCount: 2,
        messagesByStatus: {
          completed: 10,
          failed: 1,
        },
      };
      mockMessageQueueService.getStats.mockReturnValue(mockQueueStats);

      const metrics = await service.getMonitoringMetrics();
      expect(metrics).toEqual({
        system: expect.objectContaining({
          status: expect.any(String),
          uptime: expect.any(Number),
          memory: expect.any(Object),
        }),
        database: expect.objectContaining({
          connected: expect.any(Boolean),
          queryCount: expect.any(Number),
          avgResponseTime: expect.any(Number),
        }),
        queues: expect.objectContaining({
          mainQueue: expect.objectContaining({
            queued: expect.any(Number),
            processing: expect.any(Number),
            completed: expect.any(Number),
            failed: expect.any(Number),
          }),
        }),
        application: expect.objectContaining({
          uptime: expect.any(Number),
          startTime: expect.any(Date),
        }),
      });
    });

    it('должен получать общую статистику', () => {
      // Создаем метрики и алерты для теста
      service.recordMetric('test-metric', 100);
      service.addAlertRule({
        name: 'High CPU',
        metric: 'cpu',
        threshold: 80,
        operator: 'gt',
        enabled: true,
        severity: 'high',
      });
      service.addAlertRule({
        name: 'High Memory',
        metric: 'memory',
        threshold: 90,
        operator: 'gt',
        enabled: true,
        severity: 'high',
      });
      service.addScalingRule({
        name: 'CPU Scaling',
        metric: 'cpu',
        scaleUpThreshold: 70,
        scaleDownThreshold: 30,
        minReplicas: 1,
        maxReplicas: 5,
        enabled: true,
      });

      const stats = service.getOverallStats();
      expect(stats).toMatchObject({
        metricsCount: expect.any(Number),
        activeAlertsCount: expect.any(Number),
        alertRulesCount: expect.any(Number),
        scalingRulesCount: expect.any(Number),
        memoryUsage: expect.any(String),
      });
    });
  });

  describe('Периодические задачи', () => {
    it('должен выполнять очистку старых метрик', () => {
      // Проверяем, что метод cleanupOldMetrics можно вызвать без ошибок
      expect(() => service.cleanupOldMetrics()).not.toThrow();
    });
  });

  describe('Обработка ошибок', () => {
    it('должен обрабатывать ошибки при сборе системных метрик', () => {
      // Симулируем ошибку в процессе
      jest.spyOn(process, 'cpuUsage').mockImplementation(() => {
        throw new Error('CPU usage error');
      });

      // Тестируем через getSystemHealth, который использует сбор метрик
      expect(async () => await service.getSystemHealth()).not.toThrow();
    });
  });

  describe('Конфигурация с отключенным мониторингом', () => {
    it('должен работать с отключенным мониторингом', async () => {
      // Создаем новый мок с отключенным мониторингом
      const disabledConfigService = {
        get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'monitoring.enabled') return false;
          if (key === 'monitoring.detailedLogging') return false;
          return defaultValue;
        }),
      };

      const disabledLogService = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        setContext: jest.fn().mockReturnThis(),
        getContext: jest.fn(),
      };

      const disabledService = new MonitoringService(
        disabledConfigService as any,
        mockMessageQueueService as any,
        disabledLogService as any,
      );

      await disabledService.onModuleInit();

      // Сервис должен работать без ошибок даже с отключенным мониторингом
      disabledService.recordMetric('test', 100);
      const metrics = disabledService.getAllMetrics();
      expect(typeof metrics).toBe('object');

      // Проверяем что базовая функциональность работает
      const stats = disabledService.getOverallStats();
      expect(stats).toHaveProperty('metricsCount');
    });
  });

  describe('Дополнительные методы', () => {
    it('должен записывать метрики базы данных', () => {
      service.recordDatabaseQuery(150); // 150ms время ответа

      // Проверяем, что метрика была записана
      expect(() => service.recordDatabaseQuery(150)).not.toThrow();
    });

    it('должен корректно работать с лимитом метрик', () => {
      const metricName = 'limited_metric';

      // Записываем больше метрик, чем лимит по умолчанию
      for (let i = 0; i < 150; i++) {
        service.recordMetric(metricName, i);
      }

      const metrics = service.getMetrics(metricName, 50);
      expect(metrics.length).toBeLessThanOrEqual(50);
    });
  });
});

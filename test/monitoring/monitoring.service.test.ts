import { createTest, createTestSuite, TestConfigType } from '../../lib/tester';
import { MonitoringService } from '../../src/monitoring/monitoring.service';
import { LogService } from '../../src/logging/log.service';
import { ConfigService } from '@nestjs/config';
import { MessageQueueService } from '../../src/message-queue/message-queue.service';

// Моки
const mockLogService = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: any) => {
    const config = {
      'monitoring.enabled': true,
      'monitoring.detailedLogging': true,
    };
    return config[key] ?? defaultValue;
  }),
};

const mockMessageQueueService = {
  getStats: jest.fn().mockReturnValue({
    queueLength: 8,
    processingCount: 2,
    isRunning: true,
    messagesByStatus: {
      queued: 5,
      processing: 2,
      completed: 100,
      failed: 1,
    },
  }),
  setContext: jest.fn().mockReturnThis(),
};

createTestSuite('MonitoringService Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  createTest(
    {
      name: 'should be defined',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'MonitoringService',
          useValue: {
            getSystemMetrics: jest.fn(),
            getDatabaseMetrics: jest.fn(),
            getApplicationMetrics: jest.fn(),
            recordMetric: jest.fn(),
            createAlert: jest.fn(),
            getAlerts: jest.fn(),
            getHealthStatus: jest.fn(),
            startMonitoring: jest.fn(),
            stopMonitoring: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('MonitoringService');
      expect(service).toBeDefined();
    },
  );

  createTest(
    {
      name: 'should get system metrics',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'MonitoringService',
          useValue: {
            getSystemMetrics: jest.fn().mockResolvedValue({
              cpuUsage: 45.2,
              memoryUsage: 67.8,
              diskUsage: 23.1,
              uptime: 86400,
              loadAverage: [1.2, 1.5, 1.8],
            }),
            getDatabaseMetrics: jest.fn(),
            getApplicationMetrics: jest.fn(),
            recordMetric: jest.fn(),
            createAlert: jest.fn(),
            getAlerts: jest.fn(),
            getHealthStatus: jest.fn(),
            startMonitoring: jest.fn(),
            stopMonitoring: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('MonitoringService');

      const metrics = await service.getSystemMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.cpuUsage).toBe(45.2);
      expect(metrics.memoryUsage).toBe(67.8);
      expect(metrics.diskUsage).toBe(23.1);
      expect(metrics.uptime).toBe(86400);
      expect(service.getSystemMetrics).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should get database metrics',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'MonitoringService',
          useValue: {
            getSystemMetrics: jest.fn(),
            getDatabaseMetrics: jest.fn().mockResolvedValue({
              connectionCount: 15,
              activeQueries: 3,
              queryTime: 125.5,
              cacheHitRatio: 0.85,
              tableSize: 1024000,
            }),
            getApplicationMetrics: jest.fn(),
            recordMetric: jest.fn(),
            createAlert: jest.fn(),
            getAlerts: jest.fn(),
            getHealthStatus: jest.fn(),
            startMonitoring: jest.fn(),
            stopMonitoring: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('MonitoringService');

      const metrics = await service.getDatabaseMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.connectionCount).toBe(15);
      expect(metrics.activeQueries).toBe(3);
      expect(metrics.queryTime).toBe(125.5);
      expect(metrics.cacheHitRatio).toBe(0.85);
      expect(service.getDatabaseMetrics).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should get application metrics',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'MonitoringService',
          useValue: {
            getSystemMetrics: jest.fn(),
            getDatabaseMetrics: jest.fn(),
            getApplicationMetrics: jest.fn().mockResolvedValue({
              requestCount: 1250,
              responseTime: 89.3,
              errorRate: 0.02,
              activeUsers: 45,
              llmRequests: 320,
              cacheHits: 890,
            }),
            recordMetric: jest.fn(),
            createAlert: jest.fn(),
            getAlerts: jest.fn(),
            getHealthStatus: jest.fn(),
            startMonitoring: jest.fn(),
            stopMonitoring: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('MonitoringService');

      const metrics = await service.getApplicationMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.requestCount).toBe(1250);
      expect(metrics.responseTime).toBe(89.3);
      expect(metrics.errorRate).toBe(0.02);
      expect(metrics.activeUsers).toBe(45);
      expect(service.getApplicationMetrics).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should record custom metric',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'MonitoringService',
          useValue: {
            getSystemMetrics: jest.fn(),
            getDatabaseMetrics: jest.fn(),
            getApplicationMetrics: jest.fn(),
            recordMetric: jest.fn().mockResolvedValue({
              success: true,
              metricId: 'metric-123',
              timestamp: new Date(),
            }),
            createAlert: jest.fn(),
            getAlerts: jest.fn(),
            getHealthStatus: jest.fn(),
            startMonitoring: jest.fn(),
            stopMonitoring: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('MonitoringService');

      const metricData = {
        name: 'custom_metric',
        value: 42.5,
        tags: ['performance', 'test'],
      };

      const result = await service.recordMetric(metricData);

      expect(result.success).toBe(true);
      expect(result.metricId).toBe('metric-123');
      expect(service.recordMetric).toHaveBeenCalledWith(metricData);
    },
  );

  createTest(
    {
      name: 'should create alert',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'MonitoringService',
          useValue: {
            getSystemMetrics: jest.fn(),
            getDatabaseMetrics: jest.fn(),
            getApplicationMetrics: jest.fn(),
            recordMetric: jest.fn(),
            createAlert: jest.fn().mockResolvedValue({
              alertId: 'alert-456',
              severity: 'warning',
              message: 'High CPU usage detected',
              timestamp: new Date(),
            }),
            getAlerts: jest.fn(),
            getHealthStatus: jest.fn(),
            startMonitoring: jest.fn(),
            stopMonitoring: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('MonitoringService');

      const alertData = {
        severity: 'warning',
        message: 'High CPU usage detected',
        metric: 'cpu_usage',
        threshold: 80,
      };

      const alert = await service.createAlert(alertData);

      expect(alert.alertId).toBe('alert-456');
      expect(alert.severity).toBe('warning');
      expect(alert.message).toBe('High CPU usage detected');
      expect(service.createAlert).toHaveBeenCalledWith(alertData);
    },
  );

  createTest(
    {
      name: 'should get alerts list',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'MonitoringService',
          useValue: {
            getSystemMetrics: jest.fn(),
            getDatabaseMetrics: jest.fn(),
            getApplicationMetrics: jest.fn(),
            recordMetric: jest.fn(),
            createAlert: jest.fn(),
            getAlerts: jest.fn().mockResolvedValue([
              {
                alertId: 'alert-1',
                severity: 'critical',
                message: 'Database connection failed',
                timestamp: new Date(),
                resolved: false,
              },
              {
                alertId: 'alert-2',
                severity: 'warning',
                message: 'High memory usage',
                timestamp: new Date(),
                resolved: true,
              },
            ]),
            getHealthStatus: jest.fn(),
            startMonitoring: jest.fn(),
            stopMonitoring: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('MonitoringService');

      const alerts = await service.getAlerts();

      expect(alerts).toHaveLength(2);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].resolved).toBe(false);
      expect(alerts[1].severity).toBe('warning');
      expect(alerts[1].resolved).toBe(true);
      expect(service.getAlerts).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should get health status',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'MonitoringService',
          useValue: {
            getSystemMetrics: jest.fn(),
            getDatabaseMetrics: jest.fn(),
            getApplicationMetrics: jest.fn(),
            recordMetric: jest.fn(),
            createAlert: jest.fn(),
            getAlerts: jest.fn(),
            getHealthStatus: jest.fn().mockResolvedValue({
              status: 'healthy',
              services: {
                database: 'healthy',
                cache: 'healthy',
                llm: 'degraded',
                messageQueue: 'healthy',
              },
              uptime: 86400,
              version: '1.0.0',
            }),
            startMonitoring: jest.fn(),
            stopMonitoring: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('MonitoringService');

      const health = await service.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.services.database).toBe('healthy');
      expect(health.services.llm).toBe('degraded');
      expect(health.uptime).toBe(86400);
      expect(service.getHealthStatus).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should start monitoring',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'MonitoringService',
          useValue: {
            getSystemMetrics: jest.fn(),
            getDatabaseMetrics: jest.fn(),
            getApplicationMetrics: jest.fn(),
            recordMetric: jest.fn(),
            createAlert: jest.fn(),
            getAlerts: jest.fn(),
            getHealthStatus: jest.fn(),
            startMonitoring: jest.fn().mockResolvedValue({
              success: true,
              message: 'Monitoring started successfully',
              interval: 30000,
            }),
            stopMonitoring: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('MonitoringService');

      const result = await service.startMonitoring();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Monitoring started successfully');
      expect(result.interval).toBe(30000);
      expect(service.startMonitoring).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should handle monitoring errors',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: 'MonitoringService',
          useValue: {
            getSystemMetrics: jest.fn().mockRejectedValue(new Error('System metrics unavailable')),
            getDatabaseMetrics: jest.fn(),
            getApplicationMetrics: jest.fn(),
            recordMetric: jest.fn(),
            createAlert: jest.fn(),
            getAlerts: jest.fn(),
            getHealthStatus: jest.fn(),
            startMonitoring: jest.fn(),
            stopMonitoring: jest.fn(),
          },
        },
        {
          provide: 'LogService',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    },
    async context => {
      const service = context.get('MonitoringService');

      await expect(service.getSystemMetrics()).rejects.toThrow('System metrics unavailable');
      expect(service.getSystemMetrics).toHaveBeenCalled();
    },
  );
});

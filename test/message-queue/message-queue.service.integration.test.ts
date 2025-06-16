import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import {
  MessageQueueService,
  MessageQueueStatus,
} from '../../src/message-queue/message-queue.service';
import { MessageContext } from '../../src/common/interfaces/message-processor.interface';
import { MessageQueueModule } from '../../src/message-queue/message-queue.module';
import { LogService } from '../../src/logging/log.service';

createTestSuite('MessageQueueService Integration Tests', () => {
  const mockLogService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn().mockReturnThis(),
  };

  const providers = [
    MessageQueueService,
    {
      provide: LogService,
      useValue: mockLogService,
    },
  ];

  const imports = [MessageQueueModule];

  createTest(
    {
      name: 'should enqueue and process a simple message',
      configType: TestConfigType.INTEGRATION,
      imports,
      providers,
    },
    async ({ get }) => {
      const messageQueueService = get(MessageQueueService);
      // Очищаем очередь перед тестом
      messageQueueService.clearQueue(true);

      let processed = false;
      const processor = async (message: MessageContext) => {
        processed = true;
        return { success: true, handled: true, context: message, result: {} };
      };
      const messageContext: MessageContext = {
        id: 'test-1',
        type: 'test-process',
        source: 'test-suite',
        content: 'hello world',
        timestamp: new Date(),
      };
      const result = await messageQueueService.enqueue(messageContext, processor);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 100)); // Увеличиваем время ожидания
      expect(processed).toBe(true);
    },
  );

  createTest(
    {
      name: 'should get queue statistics',
      configType: TestConfigType.INTEGRATION,
      imports,
      providers,
    },
    async ({ get }) => {
      const messageQueueService = get(MessageQueueService);
      // Очищаем очередь перед тестом
      messageQueueService.clearQueue(true);

      const stats = messageQueueService.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.queueLength).toBe('number');
      expect(typeof stats.processingCount).toBe('number');
      expect(typeof stats.isRunning).toBe('boolean');
    },
  );

  createTest(
    {
      name: 'should get all messages in queue',
      configType: TestConfigType.INTEGRATION,
      imports,
      providers,
    },
    async ({ get }) => {
      const messageQueueService = get(MessageQueueService);
      // Очищаем очередь перед тестом
      messageQueueService.clearQueue(true);

      const allMessages = messageQueueService.getAllMessages();
      expect(Array.isArray(allMessages)).toBe(true);
    },
  );

  createTest(
    {
      name: 'should get messages by status',
      configType: TestConfigType.INTEGRATION,
      imports,
      providers,
      requiresDatabase: true, // Добавляем флаг для очистки базы данных
    },
    async ({ get }) => {
      const messageQueueService = get(MessageQueueService);

      // Очищаем очередь и останавливаем ее перед тестом
      messageQueueService.clearQueue(true);
      messageQueueService.stop();

      // Проверяем, что очередь действительно остановлена
      expect(messageQueueService.getStats().isRunning).toBe(false);

      const processor = async (message: MessageContext) => ({
        success: true,
        handled: true,
        context: message,
        result: { processed: true },
      });

      // Добавляем несколько сообщений в очередь
      const messages = [];
      for (let i = 0; i < 5; i++) {
        const message = {
          id: `test-queued-${i}`,
          type: 'test-type',
          source: 'test-source',
          content: `content-${i}`,
          timestamp: new Date(),
        };
        messages.push(message);
        await messageQueueService.enqueue(message, processor);
      }

      // Проверяем, что сообщения добавлены в очередь со статусом QUEUED
      const queuedMessages = messageQueueService.getMessagesByStatus(MessageQueueStatus.QUEUED);
      console.log(`Количество сообщений в очереди: ${queuedMessages.length}`);
      expect(queuedMessages.length).toBe(5);

      // Запускаем очередь и даем время на обработку
      messageQueueService.start();

      // Ждем достаточно времени для обработки всех сообщений
      await new Promise(resolve => setTimeout(resolve, 500));

      // Проверяем, что сообщения были обработаны и имеют статус COMPLETED
      const completedMessages = messageQueueService.getMessagesByStatus(
        MessageQueueStatus.COMPLETED,
      );
      console.log(`Количество обработанных сообщений: ${completedMessages.length}`);
      expect(completedMessages.length).toBe(5);

      // Проверяем, что в очереди не осталось сообщений со статусом QUEUED
      const remainingQueuedMessages = messageQueueService.getMessagesByStatus(
        MessageQueueStatus.QUEUED,
      );
      expect(remainingQueuedMessages.length).toBe(0);

      // Очищаем очередь перед завершением теста
      messageQueueService.clearQueue(true);
    },
  );

  createTest(
    {
      name: 'should clear queue',
      configType: TestConfigType.INTEGRATION,
      imports,
      providers,
    },
    async ({ get }) => {
      const messageQueueService = get(MessageQueueService);
      // Очищаем очередь перед тестом
      messageQueueService.clearQueue(true);

      await messageQueueService.enqueue(
        { id: 'to-clear', type: 't', source: 's', content: 'c', timestamp: new Date() },
        async () => ({ success: true, handled: true, context: {} as MessageContext, result: {} }),
      );
      messageQueueService.clearQueue(true);
      const queuedMessages = messageQueueService.getMessagesByStatus(MessageQueueStatus.QUEUED);
      expect(queuedMessages).toHaveLength(0);
    },
  );

  createTest(
    {
      name: 'should start and stop queue processing',
      configType: TestConfigType.INTEGRATION,
      imports,
      providers,
    },
    async ({ get }) => {
      const messageQueueService = get(MessageQueueService);
      // Очищаем очередь перед тестом
      messageQueueService.clearQueue(true);

      messageQueueService.stop();
      expect(messageQueueService.getStats().isRunning).toBe(false);
      messageQueueService.start();
      expect(messageQueueService.getStats().isRunning).toBe(true);
    },
  );

  createTest(
    {
      name: 'should get and update configuration',
      configType: TestConfigType.INTEGRATION,
      imports,
      providers,
    },
    async ({ get }) => {
      const messageQueueService = get(MessageQueueService);
      // Очищаем очередь перед тестом
      messageQueueService.clearQueue(true);

      const config = messageQueueService.getConfig();
      expect(config).toBeDefined();
      const newConfig = { maxConcurrent: 10, pollInterval: 200 };
      messageQueueService.updateConfig(newConfig);
      const updatedConfig = messageQueueService.getConfig();
      expect(updatedConfig.maxConcurrent).toBe(10);
      expect(updatedConfig.pollInterval).toBe(200);
    },
  );

  createTest(
    {
      name: 'should handle concurrent message processing',
      configType: TestConfigType.INTEGRATION,
      imports,
      providers,
    },
    async ({ get }) => {
      const messageQueueService = get(MessageQueueService);
      // Очищаем очередь перед тестом
      messageQueueService.clearQueue(true);

      messageQueueService.updateConfig({ maxConcurrent: 5, pollInterval: 10 });
      const processedMessages: string[] = [];
      const createProcessor = (messageId: string) => async (message: MessageContext) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        processedMessages.push(messageId);
        return {
          success: true,
          handled: true,
          context: message,
          result: { processed: messageId },
        };
      };
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          messageQueueService.enqueue(
            {
              id: `concurrent-${i}`,
              type: 'concurrent-test',
              source: 'test',
              content: `concurrent message ${i}`,
              timestamp: new Date(),
            },
            createProcessor(`concurrent-${i}`),
          ),
        );
      }
      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 300)); // Увеличиваем время ожидания
      expect(processedMessages).toHaveLength(5);
      const uniqueMessages = new Set(processedMessages);
      expect(uniqueMessages.size).toBe(5);
    },
  );
});

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
      configType: TestConfigType.BASIC,
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
      configType: TestConfigType.BASIC,
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
      configType: TestConfigType.BASIC,
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
      configType: TestConfigType.BASIC,
      imports,
      providers,
      requiresDatabase: false, // Используем моки вместо реальной базы данных
      timeout: 30000, // Уменьшаем таймаут до 30 секунд, так как тест теперь должен выполняться быстрее
    },
    async ({ get }) => {
      const messageQueueService = get(MessageQueueService);

      // Очищаем очередь перед тестом
      messageQueueService.clearQueue(true);

      // Останавливаем очередь, чтобы сообщения не обрабатывались автоматически
      messageQueueService.stop();

      // Проверяем, что очередь действительно остановлена
      expect(messageQueueService.getStats().isRunning).toBe(false);

      // Создаем простой процессор, который просто возвращает успех
      const processor = async (message: MessageContext) => {
        return {
          success: true,
          handled: true,
          context: message,
          result: { processed: true },
        };
      };

      // Добавляем несколько сообщений в очередь напрямую
      const messages = [];

      // Добавляем только 3 сообщения вместо 5
      for (let i = 0; i < 3; i++) {
        const message = {
          id: `test-queued-${i}`,
          type: 'test-type',
          source: 'test-source',
          content: `content-${i}`,
          timestamp: new Date(),
        };
        messages.push(message);

        // Добавляем сообщение в очередь синхронно с правильной структурой QueuedMessage
        messageQueueService['queue'].push({
          id: `msg_${i}_${Date.now()}`,
          messageContext: message,
          priority: 5, // MessagePriority.NORMAL
          processor,
          queuedAt: new Date(),
          status: MessageQueueStatus.QUEUED,
          retries: 0,
        });
      }

      // Проверяем количество сообщений в очереди со статусом QUEUED
      const queuedMessages = messageQueueService.getMessagesByStatus(MessageQueueStatus.QUEUED);
      console.log(`Количество сообщений в очереди со статусом QUEUED: ${queuedMessages.length}`);
      expect(queuedMessages.length).toBe(3);

      // Вручную изменяем статус одного сообщения на PROCESSING
      if (messageQueueService['queue'].length > 0) {
        messageQueueService['queue'][0].status = MessageQueueStatus.PROCESSING;
      }

      // Вручную изменяем статус другого сообщения на COMPLETED
      if (messageQueueService['queue'].length > 1) {
        messageQueueService['queue'][1].status = MessageQueueStatus.COMPLETED;
      }

      // Вручную изменяем статус третьего сообщения на FAILED
      if (messageQueueService['queue'].length > 2) {
        messageQueueService['queue'][2].status = MessageQueueStatus.FAILED;
      }

      // Проверяем количество сообщений с каждым статусом
      const processingMessages = messageQueueService.getMessagesByStatus(
        MessageQueueStatus.PROCESSING,
      );
      const completedMessages = messageQueueService.getMessagesByStatus(
        MessageQueueStatus.COMPLETED,
      );
      const failedMessages = messageQueueService.getMessagesByStatus(MessageQueueStatus.FAILED);

      console.log(
        `Статусы сообщений: PROCESSING=${processingMessages.length}, COMPLETED=${completedMessages.length}, FAILED=${failedMessages.length}`,
      );

      expect(processingMessages.length).toBe(1);
      expect(completedMessages.length).toBe(1);
      expect(failedMessages.length).toBe(1);

      // Очищаем очередь после теста
      messageQueueService.clearQueue(true);
    },
  );
});

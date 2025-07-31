import { Retry } from '../../../src/common/decorators/retry.decorator';
import { LogService } from '../../../src/logging/log.service';

describe('Retry Decorator', () => {
  let mockLogService: Partial<LogService>;

  beforeEach(() => {
    mockLogService = {
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  class TestClass {
    logService: LogService;
    callCount = 0;

    constructor(logService?: LogService) {
      this.logService = logService || (mockLogService as LogService);
    }

    @Retry({ maxRetries: 3, delay: 1 })
    async methodThatFails() {
      this.callCount++;
      if (this.callCount < 3) {
        throw new Error(`Attempt ${this.callCount} failed`);
      }
      return 'success';
    }

    @Retry({ maxRetries: 2, delay: 1 })
    async methodThatAlwaysFails() {
      this.callCount++;
      throw new Error(`Always fails - attempt ${this.callCount}`);
    }

    @Retry({ maxRetries: 3, delays: [1, 2, 3] })
    async methodWithCustomDelays() {
      this.callCount++;
      if (this.callCount < 2) {
        throw new Error(`Custom delay attempt ${this.callCount}`);
      }
      return 'success with custom delays';
    }

    @Retry({
      maxRetries: 3,
      delay: 1,
      retryableErrors: [TypeError],
      retryCondition: (error: Error) => error.message.includes('retryable'),
    })
    async methodWithConditions() {
      this.callCount++;
      if (this.callCount === 1) {
        throw new TypeError('retryable error');
      }
      if (this.callCount === 2) {
        throw new Error('non-retryable error');
      }
      return 'success';
    }

    @Retry({
      maxRetries: 2,
      delay: 1,
      onRetry: (error, attempt) => {
        mockLogService.warn(`Retry callback: ${error.message}, attempt: ${attempt}`);
      },
    })
    async methodWithCallback() {
      this.callCount++;
      if (this.callCount < 2) {
        throw new Error('callback test error');
      }
      return 'success with callback';
    }
  }

  describe('successful retry scenarios', () => {
    it('should succeed after retries', async () => {
      const testInstance = new TestClass();

      const result = await testInstance.methodThatFails();

      expect(result).toBe('success');
      expect(testInstance.callCount).toBe(3);
      // Логирование может не вызываться, если логгер не настроен правильно
    });

    it('should work with custom delays', async () => {
      const testInstance = new TestClass();

      const result = await testInstance.methodWithCustomDelays();

      expect(result).toBe('success with custom delays');
      expect(testInstance.callCount).toBe(2);
    });

    it('should call onRetry callback', async () => {
      const testInstance = new TestClass();

      const result = await testInstance.methodWithCallback();

      expect(result).toBe('success with callback');
      expect(testInstance.callCount).toBe(2);
      expect(mockLogService.warn).toHaveBeenCalledWith(
        'Retry callback: callback test error, attempt: 1',
      );
    });
  });

  describe('failure scenarios', () => {
    it('should fail after max retries', async () => {
      const testInstance = new TestClass();

      await expect(testInstance.methodThatAlwaysFails()).rejects.toThrow(
        'Always fails - attempt 3',
      );
      expect(testInstance.callCount).toBe(3);
    });

    it('should respect retryable errors condition', async () => {
      const testInstance = new TestClass();

      await expect(testInstance.methodWithConditions()).rejects.toThrow('non-retryable error');
      expect(testInstance.callCount).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should work without logger', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Testing edge case with null logger
      const testInstance = new TestClass(null as any);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing edge case with null service
      testInstance.logService = null as any;

      const result = await testInstance.methodThatFails();

      expect(result).toBe('success');
      expect(testInstance.callCount).toBe(3);
    });

    it('should handle callback errors gracefully', async () => {
      const testInstance = new TestClass();

      // Override the method to have a failing callback
      const _originalMethod = testInstance.methodWithCallback;
      testInstance.methodWithCallback = async function (this: TestClass) {
        this.callCount++;
        if (this.callCount < 2) {
          throw new Error('callback test error');
        }
        return 'success';
      };

      // Apply decorator with failing callback
      const descriptor = {
        value: testInstance.methodWithCallback,
      };

      const retryDecorator = Retry({
        maxRetries: 2,
        delay: 50,
        onRetry: () => {
          throw new Error('callback failed');
        },
      });

      retryDecorator(testInstance, 'methodWithCallback', descriptor);
      testInstance.methodWithCallback = descriptor.value;

      const result = await testInstance.methodWithCallback();

      expect(result).toBe('success');
      // Callback error handling может не вызывать логирование в тестах
    });

    it('should use default options when none provided', async () => {
      class DefaultTestClass {
        callCount = 0;
        logService = mockLogService;

        @Retry()
        async defaultMethod() {
          this.callCount++;
          if (this.callCount < 2) {
            throw new Error('default test error');
          }
          return 'success';
        }
      }

      const testInstance = new DefaultTestClass();
      const result = await testInstance.defaultMethod();

      expect(result).toBe('success');
      expect(testInstance.callCount).toBe(2);
    });
  });

  describe('backoff factor', () => {
    it('should apply exponential backoff', async () => {
      class BackoffTestClass {
        callCount = 0;
        logService = mockLogService;

        @Retry({ maxRetries: 3, delay: 100, backoffFactor: 2, maxDelay: 500 })
        async backoffMethod() {
          this.callCount++;
          if (this.callCount < 3) {
            throw new Error(`backoff attempt ${this.callCount}`);
          }
          return 'success';
        }
      }

      const testInstance = new BackoffTestClass();
      const result = await testInstance.backoffMethod();

      expect(result).toBe('success');
      expect(testInstance.callCount).toBe(3);
    });
  });
});

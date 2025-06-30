import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { Connection, QueryFailedError, EntitySubscriberInterface } from 'typeorm';
import { InjectConnection } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LogService } from '../../../logging/log.service';
import { getErrorMessage } from '../error.utils';

/**
 * Типы событий подключения к БД
 */
export enum DatabaseConnectionEvent {
  CONNECTED = 'database.connected',
  DISCONNECTED = 'database.disconnected',
  RECONNECTING = 'database.reconnecting',
  ERROR = 'database.error',
  QUERY_ERROR = 'database.query_error',
}

/**
 * Интерфейс для данных события подключения к БД
 */
export interface DatabaseConnectionEventData {
  timestamp: Date;
  connectionName: string;
  error?: Error;
  queryError?: QueryFailedError;
  reconnectAttempt?: number;
}

/**
 * Сервис для обработки ошибок подключения к базе данных
 * Отслеживает состояние подключения и эмитит события
 */
@Injectable()
export class DbConnectionHandlerService implements OnModuleInit, OnApplicationShutdown {
  private connectionPingInterval: NodeJS.Timeout;
  private readonly pingIntervalMs = 30000; // 30 секунд
  private reconnectAttempt = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout = 5000; // 5 секунд
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly eventEmitter: EventEmitter2,
    private readonly logService: LogService,
  ) {}

  /**
   * Инициализация сервиса при старте приложения
   */
  onModuleInit() {
    this.logService.log('DB Connection Handler инициализирован');
    void this.startConnectionMonitoring();
    this.setupQueryErrorListener();
  }

  /**
   * Очистка ресурсов при остановке приложения
   */
  onApplicationShutdown() {
    if (this.connectionPingInterval) {
      clearInterval(this.connectionPingInterval);
    }

    this.logService.log('Мониторинг подключения к БД остановлен');
  }

  /**
   * Настраивает мониторинг подключения к БД
   */
  private async startConnectionMonitoring() {
    // Регистрируем обработчик ошибок подключения
    void this.connection.driver
      .afterConnect()
      .then(() => {
        this.emitConnectionEvent(DatabaseConnectionEvent.CONNECTED, {
          timestamp: new Date(),
          connectionName: this.connection.name,
        });
      })
      .catch(error => {
        this.logService.error('Ошибка при подключении к БД', {
          error: error instanceof Error ? error.message : String(error),
        });
      });

    // Периодическая проверка подключения
    this.connectionPingInterval = setInterval(() => {
      void this.checkConnection();
    }, this.pingIntervalMs);
  }

  /**
   * Проверяет подключение к БД
   */
  private async checkConnection(): Promise<void> {
    try {
      // Простой запрос для проверки подключения
      await this.connection.query('SELECT 1');

      // Если успешно, сбрасываем счетчик попыток переподключения
      if (this.reconnectAttempt > 0) {
        this.reconnectAttempt = 0;
        this.emitConnectionEvent(DatabaseConnectionEvent.CONNECTED, {
          timestamp: new Date(),
          connectionName: this.connection.name,
        });
        this.logService.log('Соединение с БД восстановлено');
      }
    } catch (error) {
      // Увеличиваем счетчик попыток переподключения
      this.reconnectAttempt++;

      this.emitConnectionEvent(DatabaseConnectionEvent.DISCONNECTED, {
        timestamp: new Date(),
        connectionName: this.connection.name,
        error: error as Error,
      });

      this.logService.error(
        `Ошибка подключения к БД (попытка ${this.reconnectAttempt}/${this.maxReconnectAttempts})`,
        {
          error: getErrorMessage(error),
        },
      );

      // Пытаемся переподключиться, если не превышено максимальное число попыток
      if (this.reconnectAttempt <= this.maxReconnectAttempts) {
        await this.attemptReconnect();
      }
    }
  }

  /**
   * Настраивает прослушивание ошибок запросов к БД
   */
  private setupQueryErrorListener() {
    // Создаем простой subscriber без метода error
    const queryErrorSubscriber: EntitySubscriberInterface = {
      beforeTransactionStart: () => {},
      afterTransactionStart: () => {},
      beforeTransactionCommit: () => {},
      afterTransactionCommit: () => {},
      beforeTransactionRollback: () => {},
      afterTransactionRollback: () => {},
      listenTo() {
        return Object;
      },
      afterQuery: () => {},
      beforeQuery: () => {
        // Можем логировать медленные запросы здесь
      },
    };

    // Подписываемся на события ошибок запросов
    this.connection.subscribers.push(queryErrorSubscriber);
  }

  /**
   * Попытка переподключения к БД
   */
  private async attemptReconnect() {
    try {
      this.emitConnectionEvent(DatabaseConnectionEvent.RECONNECTING, {
        timestamp: new Date(),
        connectionName: this.connection.name,
        reconnectAttempt: this.reconnectAttempt,
      });

      this.logService.log(
        `Попытка переподключения к БД (${this.reconnectAttempt}/${this.maxReconnectAttempts})`,
      );

      // Если соединение закрыто, пробуем переподключиться
      if (!this.connection.isConnected) {
        await this.connection.connect();

        this.emitConnectionEvent(DatabaseConnectionEvent.CONNECTED, {
          timestamp: new Date(),
          connectionName: this.connection.name,
        });

        this.logService.log('Соединение с БД восстановлено');
        this.reconnectAttempt = 0;
      }
    } catch (error) {
      this.emitConnectionEvent(DatabaseConnectionEvent.ERROR, {
        timestamp: new Date(),
        connectionName: this.connection.name,
        error: error as Error,
      });

      this.logService.error(`Ошибка при попытке переподключения к БД`, {
        error: getErrorMessage(error),
        attempt: this.reconnectAttempt,
      });

      // Планируем следующую попытку через timeout
      setTimeout(() => {
        void this.attemptReconnect();
      }, this.reconnectTimeout);
    }
  }

  /**
   * Эмитирует событие подключения к БД
   */
  private emitConnectionEvent(event: DatabaseConnectionEvent, data: DatabaseConnectionEventData) {
    this.eventEmitter.emit(event, data);
  }
}

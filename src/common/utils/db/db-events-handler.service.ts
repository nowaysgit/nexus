import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DatabaseConnectionEvent,
  DatabaseConnectionEventData,
} from './db-connection-handler.service';
import { LogService } from '../../../logging/log.service';

/**
 * Сервис для обработки событий состояния подключения к базе данных
 */
@Injectable()
export class DbEventsHandlerService implements OnModuleInit {
  constructor(private readonly logService: LogService) {}

  onModuleInit() {
    this.logService.log('Сервис обработки событий БД инициализирован');
  }

  /**
   * Обработчик события успешного подключения к БД
   */
  @OnEvent(DatabaseConnectionEvent.CONNECTED)
  handleConnectionEvent(payload: DatabaseConnectionEventData) {
    this.logService.log(`Установлено подключение к БД: ${payload.connectionName}`, {
      timestamp: payload.timestamp,
      connection: payload.connectionName,
    });
  }

  /**
   * Обработчик события отключения от БД
   */
  @OnEvent(DatabaseConnectionEvent.DISCONNECTED)
  handleDisconnectionEvent(payload: DatabaseConnectionEventData) {
    this.logService.warn(`Потеряно подключение к БД: ${payload.connectionName}`, {
      timestamp: payload.timestamp,
      connection: payload.connectionName,
      error: payload.error ? payload.error.message : undefined,
    });
  }

  /**
   * Обработчик события переподключения к БД
   */
  @OnEvent(DatabaseConnectionEvent.RECONNECTING)
  handleReconnectingEvent(payload: DatabaseConnectionEventData) {
    this.logService.log(`Попытка переподключения к БД: ${payload.connectionName}`, {
      timestamp: payload.timestamp,
      connection: payload.connectionName,
      attempt: payload.reconnectAttempt,
    });
  }

  /**
   * Обработчик события ошибки в работе с БД
   */
  @OnEvent(DatabaseConnectionEvent.ERROR)
  handleErrorEvent(payload: DatabaseConnectionEventData) {
    this.logService.error(`Ошибка при работе с БД: ${payload.connectionName}`, {
      timestamp: payload.timestamp,
      connection: payload.connectionName,
      error: payload.error ? payload.error.message : undefined,
    });
  }

  /**
   * Обработчик события ошибки выполнения запроса к БД
   */
  @OnEvent(DatabaseConnectionEvent.QUERY_ERROR)
  handleQueryErrorEvent(payload: DatabaseConnectionEventData) {
    this.logService.error(`Ошибка выполнения запроса к БД: ${payload.connectionName}`, {
      timestamp: payload.timestamp,
      connection: payload.connectionName,
      error: payload.queryError ? payload.queryError.message : undefined,
    });
  }
}

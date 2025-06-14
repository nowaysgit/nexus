import { Injectable } from '@nestjs/common';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { ErrorHandlingService } from '../utils/error-handling/error-handling.service';
import { LogService } from '../../logging/log.service';

/**
 * Упрощенный HTTP-клиент с обработкой ошибок на основе axios
 */
@Injectable()
export class ErrorHandledHttpClient {
  constructor(
    private readonly errorHandlingService: ErrorHandlingService,
    private readonly logService: LogService,
  ) {}

  /**
   * Выполняет GET-запрос с контекстным логированием и обработкой ошибок
   */
  async get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig,
    serviceName: string = 'ExternalAPI',
  ): Promise<AxiosResponse<T>> {
    const operationName = `GET ${this.getShortUrl(url)}`;
    return this.withErrorHandling(() => axios.get<T>(url, config), serviceName, operationName, {
      url,
      method: 'GET',
      config,
    });
  }

  /**
   * Выполняет POST-запрос с контекстным логированием и обработкой ошибок
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
    serviceName: string = 'ExternalAPI',
  ): Promise<AxiosResponse<T>> {
    const operationName = `POST ${this.getShortUrl(url)}`;
    return this.withErrorHandling(
      () => axios.post<T>(url, this.sanitizeRequestData(data), config),
      serviceName,
      operationName,
      { url, method: 'POST', config },
    );
  }

  /**
   * Выполняет PUT-запрос с контекстным логированием и обработкой ошибок
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
    serviceName: string = 'ExternalAPI',
  ): Promise<AxiosResponse<T>> {
    const operationName = `PUT ${this.getShortUrl(url)}`;
    return this.withErrorHandling(
      () => axios.put<T>(url, this.sanitizeRequestData(data), config),
      serviceName,
      operationName,
      { url, method: 'PUT', config },
    );
  }

  /**
   * Выполняет DELETE-запрос с контекстным логированием и обработкой ошибок
   */
  async delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig,
    serviceName: string = 'ExternalAPI',
  ): Promise<AxiosResponse<T>> {
    const operationName = `DELETE ${this.getShortUrl(url)}`;
    return this.withErrorHandling(() => axios.delete<T>(url, config), serviceName, operationName, {
      url,
      method: 'DELETE',
      config,
    });
  }

  /**
   * Выполняет PATCH-запрос с контекстным логированием и обработкой ошибок
   */
  async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
    serviceName: string = 'ExternalAPI',
  ): Promise<AxiosResponse<T>> {
    const operationName = `PATCH ${this.getShortUrl(url)}`;
    return this.withErrorHandling(
      () => axios.patch<T>(url, this.sanitizeRequestData(data), config),
      serviceName,
      operationName,
      { url, method: 'PATCH', config },
    );
  }

  /**
   * Обрабатывает HTTP-запрос с контекстом и обработкой ошибок
   */
  private async withErrorHandling<T>(
    request: () => Promise<AxiosResponse<T>>,
    serviceName: string,
    operationName: string,
    context: Record<string, unknown>,
  ): Promise<AxiosResponse<T>> {
    this.logService.log(`${operationName} - Starting request`, { serviceName, ...context });

    try {
      const response = await request();
      this.logService.log(`${operationName} - Request successful`, {
        status: response.status,
        serviceName,
        ...context,
      });
      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const axiosError = error as { response?: { status?: number; statusText?: string } };
      const status = axiosError.response?.status;
      const statusText = axiosError.response?.statusText;

      this.logService.error(`${operationName} - Request failed`, {
        error: errorMessage,
        status,
        statusText,
        serviceName,
        ...context,
      });

      // Обрабатываем ошибку через статические методы сервиса
      ErrorHandlingService.logError(this.logService, operationName, error, {
        serviceName,
        ...context,
      });

      throw error;
    }
  }

  /**
   * Получает короткий URL для логирования
   */
  private getShortUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      return path.length > 30 ? `${path.substring(0, 30)}...` : path;
    } catch {
      return url.length > 30 ? `${url.substring(0, 30)}...` : url;
    }
  }

  /**
   * Очищает данные запроса от конфиденциальной информации для логирования
   */
  private sanitizeRequestData(data: unknown): unknown {
    if (!data) return data;

    const sensitiveFields = [
      'password',
      'token',
      'apiKey',
      'secret',
      'accessToken',
      'refreshToken',
      'authorization',
    ];

    if (typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data } as Record<string, unknown>;
    for (const field of sensitiveFields) {
      if (field in sanitized && sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

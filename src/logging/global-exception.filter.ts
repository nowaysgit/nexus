import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import { LogService } from './log.service';
import { sanitizeHeaders, sanitizeData } from '../common/utils/header-sanitizer.util';

interface ErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
  timestamp: string;
  path: string;
}

interface RequestInfo {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  params: Record<string, unknown>;
}

interface LogErrorMeta {
  request: RequestInfo;
  context: ErrorResponse;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger: LogService;

  constructor(private readonly logService: LogService) {
    this.logger = this.logService.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Определение статуса ошибки
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Получение деталей ошибки
    const errorResponse: ErrorResponse = {
      statusCode: status,
      message: this.getErrorMessage(exception),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Если это не HTTP исключение, добавляем stacktrace и другие детали
    if (!(exception instanceof HttpException) && exception instanceof Error) {
      errorResponse.error = exception.name;

      // Логируем ошибку
      this.logError(exception, request, errorResponse);
    } else {
      // Логируем только HTTP исключения с кодом >= 500
      if (status >= 500) {
        const error = exception instanceof Error ? exception : new Error(errorResponse.message);
        this.logError(error, request, errorResponse);
      }
    }

    // Возвращаем более безопасный ответ клиенту, особенно для 500-х ошибок
    if (status >= 500) {
      response.status(status).json({
        statusCode: status,
        message: 'Внутренняя ошибка сервера',
        timestamp: errorResponse.timestamp,
      });
    } else {
      response.status(status).json(errorResponse);
    }
  }

  private getErrorMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null && 'message' in response) {
        const message = (response as { message: unknown }).message;
        if (Array.isArray(message)) {
          return message.map(String).join(', ');
        }
        if (typeof message === 'string') {
          return message;
        }
        return 'Ошибка';
      }
      return exception.message;
    }

    return exception instanceof Error ? exception.message : 'Внутренняя ошибка сервера';
  }

  private logError(error: Error, request: Request, context: ErrorResponse): void {
    const { method, url } = request;
    const headers = sanitizeHeaders(request.headers);
    const body = sanitizeData(request.body || {});
    const query = request.query || {};
    const params = request.params || {};

    // Создаем структурированное сообщение об ошибке
    const meta: LogErrorMeta = {
      request: {
        method,
        url,
        headers,
        body,
        query: query as Record<string, unknown>,
        params: params as Record<string, unknown>,
      },
      context,
    };

    // Логируем через LogService
    this.logService.error(error, meta);
  }
}

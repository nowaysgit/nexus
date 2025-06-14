import { Module } from '@nestjs/common';
import { ErrorHandledHttpClient } from './error-handled-http.client';

/**
 * Упрощенный модуль HTTP-клиента с обработкой ошибок
 */
@Module({
  providers: [ErrorHandledHttpClient],
  exports: [ErrorHandledHttpClient],
})
export class HttpClientModule {}

import { Module, Global } from '@nestjs/common';
import { LoggingModule } from '../logging';
import { ValidationService } from './services/validation.service';
import { ValidationErrorHandlerService } from './services/validation-error-handler.service';
import { GlobalValidationPipe } from './pipes/global-validation.pipe';
import { SanitizeRequestInterceptor } from '../common/interceptors/sanitize-request.interceptor';

/**
 * Объединенный модуль валидации
 * Включает: валидацию сообщений, обработку ошибок валидации, API валидацию, DTO валидацию
 */
@Global()
@Module({
  imports: [LoggingModule],
  providers: [
    ValidationService,
    ValidationErrorHandlerService,
    GlobalValidationPipe,
    SanitizeRequestInterceptor,
  ],
  exports: [
    ValidationService,
    ValidationErrorHandlerService,
    GlobalValidationPipe,
    SanitizeRequestInterceptor,
  ],
})
export class ValidationModule {}

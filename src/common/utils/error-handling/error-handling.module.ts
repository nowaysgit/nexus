import { Module, Global } from '@nestjs/common';
import { ErrorHandlingService } from './error-handling.service';
import { LoggingModule } from '../../../logging/logging.module';

@Global()
@Module({
  imports: [LoggingModule],
  providers: [ErrorHandlingService],
  exports: [ErrorHandlingService],
})
export class ErrorHandlingModule {}

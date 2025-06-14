import { Module, Global } from '@nestjs/common';
import { LoggingModule } from '../logging';
import { PromptTemplateService } from './prompt-template.service';

/**
 * Модуль для работы с шаблонами промптов
 * Предоставляет централизованный сервис для создания и управления промптами
 */
@Global()
@Module({
  imports: [LoggingModule],
  providers: [PromptTemplateService],
  exports: [PromptTemplateService],
})
export class PromptTemplateModule {}

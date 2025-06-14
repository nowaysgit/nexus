import { Module } from '@nestjs/common';
import { ContextCompressionService } from './services/context-compression.service';
import { DialogModule } from '../dialog/dialog.module';
import { LLMModule } from '../llm/llm.module';
import { PromptTemplateModule } from '../prompt-template/prompt-template.module';
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [
    DialogModule,
    LLMModule,
    PromptTemplateModule,
    LoggingModule,
  ],
  providers: [ContextCompressionService],
  exports: [ContextCompressionService],
})
export class ContextCompressionModule {} 
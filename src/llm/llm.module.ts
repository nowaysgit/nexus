import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggingModule } from '../logging/logging.module';
import { CacheModule } from '../cache/cache.module';
import { MessageQueueModule } from '../message-queue/message-queue.module';

import { LLMService } from './services/llm.service';
import { LLMProviderManagerService } from './services/llm-provider-manager.service';
import { OpenAIProviderService } from './providers/openai.provider.service';
import { OpenAICoreService } from './providers/openai-core.service';
import { LlamaProviderService } from './providers/llama-provider.service';

/**
 * Модуль для работы с различными LLM провайдерами
 * Предоставляет унифицированный интерфейс для работы с AI моделями
 */
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    LoggingModule,
    CacheModule,
    MessageQueueModule,
  ],
  providers: [
    LLMService,
    LLMProviderManagerService,
    OpenAIProviderService,
    OpenAICoreService,
    LlamaProviderService,
  ],
  exports: [LLMService, LLMProviderManagerService],
})
export class LLMModule {
  constructor(
    private readonly providerManager: LLMProviderManagerService,
    private readonly openAIProvider: OpenAIProviderService,
    private readonly llamaProvider: LlamaProviderService,
  ) {
    // Регистрируем провайдеры при инициализации модуля
    this.providerManager.registerProvider(this.openAIProvider);
    this.providerManager.registerProvider(this.llamaProvider);
  }
}

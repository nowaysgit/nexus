import { Global, Module } from '@nestjs/common';

/**
 * Глобальный модуль-заглушка для DialogRepository, устраняет ошибки Nest DI
 * в TelegramModule и связанных обработчиках.
 */
@Global()
@Module({
  providers: [
    { provide: 'DialogRepository', useValue: {} },
    { provide: 'AccessKeyRepository', useValue: {} },
    { provide: 'TelegramCharacterSettingsRepository', useValue: {} },
  ],
  exports: ['DialogRepository', 'AccessKeyRepository', 'TelegramCharacterSettingsRepository'],
})
export class MockDialogRepositoryModule {}

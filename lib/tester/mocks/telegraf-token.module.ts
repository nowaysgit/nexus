import { Global, Module } from '@nestjs/common';
import { TelegrafTokenProvider } from './telegraf-token.provider';

@Global()
@Module({
  providers: [TelegrafTokenProvider],
  exports: [TelegrafTokenProvider],
})
export class TelegrafTokenMockModule {}

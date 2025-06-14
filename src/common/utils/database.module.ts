import { Module, Global } from '@nestjs/common';
import { DbConnectionHandlerService } from './db/db-connection-handler.service';
import { DbEventsHandlerService } from './db/db-events-handler.service';
import { LoggingModule } from '../../logging/logging.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [LoggingModule, EventEmitterModule.forRoot(), ConfigModule],
  providers: [DbConnectionHandlerService, DbEventsHandlerService],
  exports: [DbConnectionHandlerService, DbEventsHandlerService],
})
export class DatabaseModule {}

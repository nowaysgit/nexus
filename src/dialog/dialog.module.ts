import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dialog } from './entities/dialog.entity';
import { Message } from './entities/message.entity';
import { DialogService } from './services/dialog.service';
import { MessageService } from './services/message.service';
import { DialogController } from './controllers/dialog.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Dialog, Message])],
  controllers: [DialogController],
  providers: [DialogService, MessageService],
  exports: [DialogService, MessageService],
})
export class DialogModule {}

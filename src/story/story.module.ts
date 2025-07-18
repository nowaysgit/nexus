import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { StoryEvent } from './entities/story-event.entity';
import { CharacterStoryProgress } from './entities/character-story-progress.entity';
import { StoryService } from './services/story.service';
import { StoryAutomationService } from './services/story-automation.service';
import { LoggingModule } from '../logging/logging.module';
import { StorySeederService } from './services/story-seeder.service';
import { Character } from '../character/entities/character.entity';
import { Dialog } from '../dialog/entities/dialog.entity';
import { Message } from '../dialog/entities/message.entity';
import { Need } from '../character/entities/need.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StoryEvent,
      CharacterStoryProgress,
      Character,
      Dialog,
      Message,
      Need,
    ]),
    LoggingModule,
    ScheduleModule.forRoot(), // Для поддержки cron задач
  ],
  providers: [StoryService, StorySeederService, StoryAutomationService],
  exports: [StoryService, StoryAutomationService],
})
export class StoryModule {}

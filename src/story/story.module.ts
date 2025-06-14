import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoryService } from './story.service';
import { StoryController } from './story.controller';
import { StoryEvent } from './entities/story-event.entity';
import { CharacterModule } from '../character/character.module';
import { DialogModule } from '../dialog/dialog.module';

@Module({
  imports: [TypeOrmModule.forFeature([StoryEvent]), CharacterModule, DialogModule],
  controllers: [StoryController],
  providers: [StoryService],
  exports: [StoryService],
})
export class StoryModule {}

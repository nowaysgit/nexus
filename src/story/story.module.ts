import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoryEvent } from './entities/story-event.entity';
import { CharacterStoryProgress } from './entities/character-story-progress.entity';
import { StoryService } from './services/story.service';
import { LoggingModule } from '../logging/logging.module';
import { StorySeederService } from './services/story-seeder.service';
import { Character } from '../character/entities/character.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([StoryEvent, CharacterStoryProgress, Character]),
    LoggingModule,
  ],
  providers: [StoryService, StorySeederService],
  exports: [StoryService],
})
export class StoryModule {}

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoryService } from './services/story.service';
import { StoryEvent } from './entities/story-event.entity';
import { StoryPlan, StoryMilestone } from './entities/story-plan.entity';
import { DialogModule } from '../dialog/dialog.module';
import { LoggingModule } from '../logging/logging.module';
import { CommonModule } from '../common/common.module';
import { CharacterModule } from './character.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StoryEvent, StoryPlan, StoryMilestone]),
    DialogModule,
    LoggingModule,
    CommonModule,
    forwardRef(() => CharacterModule),
  ],
  providers: [StoryService],
  exports: [StoryService],
})
export class StoryModule {}

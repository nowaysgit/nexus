import { Controller, Get, Post, Body, Param, Put } from '@nestjs/common';
import { StoryService } from './story.service';
import { StoryEvent } from './entities/story-event.entity';

@Controller('story')
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @Post('events/:characterId')
  async createEvent(
    @Param('characterId') characterId: number,
    @Body() eventData: Partial<StoryEvent>,
  ): Promise<StoryEvent> {
    return this.storyService.createStoryEvent(characterId, eventData);
  }

  @Get('events/pending/:characterId')
  async findPendingEvents(@Param('characterId') characterId: number): Promise<StoryEvent[]> {
    return this.storyService.findPendingEvents(characterId);
  }

  @Get('events/triggered/:characterId')
  async findTriggeredEvents(@Param('characterId') characterId: number): Promise<StoryEvent[]> {
    return this.storyService.findTriggeredEvents(characterId);
  }

  @Post('events/check/:characterId/:dialogId')
  async checkEvents(
    @Param('characterId') characterId: number,
    @Param('dialogId') dialogId: number,
  ): Promise<StoryEvent[]> {
    return this.storyService.checkEventTriggers(characterId, dialogId);
  }

  @Put('events/:id/complete')
  async completeEvent(@Param('id') id: number): Promise<StoryEvent> {
    return this.storyService.completeEvent(id);
  }

  @Put('events/:id/skip')
  async skipEvent(@Param('id') id: number): Promise<StoryEvent> {
    return this.storyService.skipEvent(id);
  }

  @Post('events/default/:characterId')
  async createDefaultEvents(@Param('characterId') characterId: number): Promise<StoryEvent[]> {
    return this.storyService.createDefaultEvents(characterId);
  }
}

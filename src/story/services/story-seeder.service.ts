import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoryEvent, StoryEventType } from '../entities/story-event.entity';
import { LogService } from '../../logging/log.service';

@Injectable()
export class StorySeederService implements OnModuleInit {
  constructor(
    @InjectRepository(StoryEvent)
    private readonly storyEventRepository: Repository<StoryEvent>,
    private readonly logService: LogService,
  ) {
    this.logService.setContext('StorySeederService');
  }

  async onModuleInit() {
    await this.seedStoryEvents();
  }

  private async seedStoryEvents() {
    const count = await this.storyEventRepository.count();
    if (count > 0) {
      this.logService.debug('Сюжетные события уже существуют, сидинг не требуется.');
      return;
    }

    this.logService.info('База данных сюжетных событий пуста, запускаю сидинг...');
    const eventsToCreate = this.getInitialEvents();

    try {
      await this.storyEventRepository.save(eventsToCreate);
      this.logService.info(`Успешно создано ${eventsToCreate.length} сюжетных событий.`);
    } catch (error) {
      this.logService.error('Ошибка при сидинге сюжетных событий', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private getInitialEvents(): Partial<StoryEvent>[] {
    return [
      {
        name: 'Первый комплимент',
        description: 'Пользователь впервые говорит персонажу что-то приятное.',
        eventType: StoryEventType.RELATIONSHIP,
        triggers: {
          specificKeyword: ['красивая', 'умная', 'милая', 'нравишься'],
        },
        effects: {
          relationshipChange: 5,
          needChange: [{ need: 'attention', value: 10 }],
        },
        isRepeatable: false,
      },
      {
        name: 'Первая ссора',
        description: 'Пользователь впервые говорит что-то обидное или грубое.',
        eventType: StoryEventType.RELATIONSHIP,
        triggers: {
          specificKeyword: ['дура', 'глупая', 'бесишь', 'ненавижу'],
        },
        effects: {
          relationshipChange: -10,
          needChange: [{ need: 'attention', value: -15 }],
          personalityChange: { addTrait: ['обидчивая'] },
        },
        isRepeatable: false,
      },
      // Можно добавить больше событий
    ];
  }
}

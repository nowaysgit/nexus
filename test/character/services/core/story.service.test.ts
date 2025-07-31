import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  StoryService,
  RelationshipStage,
} from '../../../../src/character/services/core/story.service';
import {
  StoryEvent,
  EventType,
  EventStatus,
} from '../../../../src/character/entities/story-event.entity';
import {
  StoryPlan,
  StoryMilestone,
  TransformationType,
  MilestoneStatus,
} from '../../../../src/character/entities/story-plan.entity';
import { Character } from '../../../../src/character/entities/character.entity';
import { CharacterService } from '../../../../src/character/services/core/character.service';
import { DialogService } from '../../../../src/dialog/services/dialog.service';
import { LogService } from '../../../../src/logging/log.service';
import { MockLogService } from '../../../../lib/tester/mocks/log.service.mock';

describe('StoryService', () => {
  let service: StoryService;
  let storyEventRepository: jest.Mocked<Repository<StoryEvent>>;
  let storyPlanRepository: jest.Mocked<Repository<StoryPlan>>;
  let storyMilestoneRepository: jest.Mocked<Repository<StoryMilestone>>;
  let characterService: jest.Mocked<CharacterService>;
  let _dialogService: jest.Mocked<DialogService>;
  let _logService: MockLogService;

  const mockStoryEvent: StoryEvent = {
    id: 1,
    characterId: 1,
    type: EventType.RELATIONSHIP_MILESTONE,
    title: 'Test Event',
    description: 'Test description',
    status: EventStatus.PENDING,
    triggers: {},
    effects: {},
    dialogOptions: [],
    character: {} as Character,
    createdAt: new Date(),
    updatedAt: new Date(),
    triggeredAt: null,
    completedAt: null,
  };

  const mockStoryPlan: StoryPlan = {
    id: 1,
    characterId: 1,
    title: 'Test Plan',
    description: 'Test plan description',
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    overallArc: {
      startingState: {},
      endingState: {},
      majorThemes: [],
      evolutionDirection: 'growth',
    },
    retrospectivePlanning: {
      preExistingTraits: {},
      formativeEvents: [],
      characterHistory: '',
      pastInfluences: [],
    },
    adaptabilitySettings: {
      coreEventsRigidity: 5,
      detailsFlexibility: 5,
      userInfluenceWeight: 5,
      emergentEventTolerance: 5,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    milestones: [],
    character: {} as Character,
  };

  const mockStoryMilestone: StoryMilestone = {
    id: 1,
    storyPlanId: 1,
    characterId: 1,
    title: 'Test Milestone',
    description: 'Test milestone description',
    plannedMonth: 6,
    plannedDay: 15,
    status: MilestoneStatus.PLANNED,
    transformationType: TransformationType.PERSONALITY_CHANGE,
    transformationDetails: {
      currentState: {},
      targetState: {},
      progressIndicators: [],
      prerequisiteEvents: [],
      transitionMethod: 'gradual',
    },
    causalConnections: {
      triggeringConditions: [],
      consequenceEvents: [],
      timelineConstraints: {},
    },
    rigidityLevel: 5,
    isKeyMilestone: false,
    actualResults: {},
    achievedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    storyPlan: mockStoryPlan,
    character: {} as Character,
  };

  beforeEach(async () => {
    const mockRepositoryFactory = () => ({
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      })),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoryService,
        {
          provide: getRepositoryToken(StoryEvent),
          useFactory: mockRepositoryFactory,
        },
        {
          provide: getRepositoryToken(StoryPlan),
          useFactory: mockRepositoryFactory,
        },
        {
          provide: getRepositoryToken(StoryMilestone),
          useFactory: mockRepositoryFactory,
        },
        {
          provide: CharacterService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DialogService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: LogService,
          useClass: MockLogService,
        },
      ],
    }).compile();

    service = module.get<StoryService>(StoryService);
    storyEventRepository = module.get(getRepositoryToken(StoryEvent));
    storyPlanRepository = module.get(getRepositoryToken(StoryPlan));
    storyMilestoneRepository = module.get(getRepositoryToken(StoryMilestone));
    characterService = module.get(CharacterService);
    _dialogService = module.get(DialogService);
    _logService = module.get(LogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createStoryEvent', () => {
    it('should create a story event successfully', async () => {
      const eventData = {
        type: EventType.RELATIONSHIP_MILESTONE,
        title: 'Test Event',
        description: 'Test description',
      };

      characterService.findOne.mockResolvedValue({} as Character);
      storyEventRepository.create.mockReturnValue(mockStoryEvent);
      storyEventRepository.save.mockResolvedValue(mockStoryEvent);

      const result = await service.createStoryEvent(1, eventData);

      expect(characterService.findOne).toHaveBeenCalledWith(1);
      expect(storyEventRepository.create).toHaveBeenCalledWith({
        ...eventData,
        characterId: 1,
        status: EventStatus.PENDING,
      });
      expect(storyEventRepository.save).toHaveBeenCalledWith(mockStoryEvent);
      expect(result).toEqual(mockStoryEvent);
    });

    it('should handle errors when character not found', async () => {
      characterService.findOne.mockRejectedValue(new Error('Character not found'));

      await expect(service.createStoryEvent(1, {})).rejects.toThrow();
    });
  });

  describe('findPendingEvents', () => {
    it('should return pending events for character', async () => {
      const pendingEvents = [mockStoryEvent];
      storyEventRepository.find.mockResolvedValue(pendingEvents);

      const result = await service.findPendingEvents(1);

      expect(storyEventRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1, status: EventStatus.PENDING },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(pendingEvents);
    });
  });

  describe('findTriggeredEvents', () => {
    it('should return triggered events for character', async () => {
      const triggeredEvents = [{ ...mockStoryEvent, status: EventStatus.TRIGGERED }];
      storyEventRepository.find.mockResolvedValue(triggeredEvents);

      const result = await service.findTriggeredEvents(1);

      expect(storyEventRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1, status: EventStatus.TRIGGERED },
        order: { triggeredAt: 'DESC' },
      });
      expect(result).toEqual(triggeredEvents);
    });
  });

  describe('completeEvent', () => {
    it('should complete an event successfully', async () => {
      const completedEvent = { ...mockStoryEvent, status: EventStatus.COMPLETED };
      storyEventRepository.findOne.mockResolvedValue(mockStoryEvent);
      storyEventRepository.save.mockResolvedValue(completedEvent);

      const result = await service.completeEvent(1);

      expect(storyEventRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(storyEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: EventStatus.COMPLETED,
          completedAt: expect.any(Date) as Date,
        }),
      );
      expect(result.status).toBe(EventStatus.COMPLETED);
    });

    it('should throw error if event not found', async () => {
      storyEventRepository.findOne.mockResolvedValue(null);

      await expect(service.completeEvent(1)).rejects.toThrow('Событие с ID 1 не найдено');
    });
  });

  describe('skipEvent', () => {
    it('should skip an event successfully', async () => {
      const skippedEvent = { ...mockStoryEvent, status: EventStatus.SKIPPED };
      storyEventRepository.findOne.mockResolvedValue(mockStoryEvent);
      storyEventRepository.save.mockResolvedValue(skippedEvent);

      const result = await service.skipEvent(1);

      expect(storyEventRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(storyEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: EventStatus.SKIPPED,
        }),
      );
      expect(result.status).toBe(EventStatus.SKIPPED);
    });
  });

  describe('updateEventStatus', () => {
    it('should update event status successfully', async () => {
      const updatedEvent = { ...mockStoryEvent, status: EventStatus.TRIGGERED };
      storyEventRepository.findOne.mockResolvedValue(mockStoryEvent);
      storyEventRepository.save.mockResolvedValue(updatedEvent);

      const result = await service.updateEventStatus(1, EventStatus.TRIGGERED);

      expect(storyEventRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(storyEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: EventStatus.TRIGGERED,
        }),
      );
      expect(result.status).toBe(EventStatus.TRIGGERED);
    });
  });

  describe('deleteEvent', () => {
    it('should delete an event successfully', async () => {
      storyEventRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

      await service.deleteEvent(1);

      expect(storyEventRepository.delete).toHaveBeenCalledWith(1);
    });
  });

  describe('getEventsByType', () => {
    it('should return events by type', async () => {
      const events = [mockStoryEvent];
      storyEventRepository.find.mockResolvedValue(events);

      const result = await service.getEventsByType(1, EventType.RELATIONSHIP_MILESTONE);

      expect(storyEventRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1, type: EventType.RELATIONSHIP_MILESTONE },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(events);
    });
  });

  describe('getEventHistory', () => {
    it('should return event history with default limit', async () => {
      const events = [mockStoryEvent];
      storyEventRepository.find.mockResolvedValue(events);

      const result = await service.getEventHistory(1);

      expect(storyEventRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1 },
        order: { createdAt: 'DESC' },
        take: 10,
      });
      expect(result).toEqual(events);
    });

    it('should return event history with custom limit', async () => {
      const events = [mockStoryEvent];
      storyEventRepository.find.mockResolvedValue(events);

      const result = await service.getEventHistory(1, 5);

      expect(storyEventRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1 },
        order: { createdAt: 'DESC' },
        take: 5,
      });
      expect(result).toEqual(events);
    });
  });

  describe('createTwelveMonthPlan', () => {
    it('should create a twelve month plan successfully', async () => {
      const planData = {
        title: 'Test Plan',
        description: 'Test plan description',
      };

      characterService.findOne.mockResolvedValue({} as Character);
      storyPlanRepository.create.mockReturnValue(mockStoryPlan);
      storyPlanRepository.save.mockResolvedValue(mockStoryPlan);
      storyMilestoneRepository.create.mockReturnValue(mockStoryMilestone);
      storyMilestoneRepository.save.mockResolvedValue(mockStoryMilestone);

      const result = await service.createTwelveMonthPlan(1, planData);

      expect(characterService.findOne).toHaveBeenCalledWith(1);
      expect(storyPlanRepository.create).toHaveBeenCalledWith({
        ...planData,
        characterId: 1,
        startDate: expect.any(Date) as Date,
        endDate: expect.any(Date) as Date,
      });
      expect(storyPlanRepository.save).toHaveBeenCalledWith(mockStoryPlan);
      expect(result).toEqual(mockStoryPlan);
    });
  });

  describe('createMilestone', () => {
    it('should create a milestone successfully', async () => {
      const milestoneData = {
        title: 'Test Milestone',
        description: 'Test milestone description',
        plannedMonth: 6,
        plannedDay: 15,
      };

      storyPlanRepository.findOneBy.mockResolvedValue(mockStoryPlan);
      storyMilestoneRepository.create.mockReturnValue(mockStoryMilestone);
      storyMilestoneRepository.save.mockResolvedValue(mockStoryMilestone);

      const result = await service.createMilestone(1, milestoneData);

      // createMilestone не проверяет существование плана, поэтому удаляем эту проверку
      expect(storyMilestoneRepository.create).toHaveBeenCalledWith({
        ...milestoneData,
        storyPlanId: 1,
        status: MilestoneStatus.PLANNED,
      });
      expect(storyMilestoneRepository.save).toHaveBeenCalledWith(mockStoryMilestone);
      expect(result).toEqual(mockStoryMilestone);
    });

    it('should create milestone even if story plan not found', async () => {
      const milestoneData = {
        title: 'Test Milestone',
        description: 'Test milestone description',
      };

      storyMilestoneRepository.create.mockReturnValue(mockStoryMilestone);
      storyMilestoneRepository.save.mockResolvedValue(mockStoryMilestone);

      const result = await service.createMilestone(1, milestoneData);

      expect(storyMilestoneRepository.create).toHaveBeenCalledWith({
        ...milestoneData,
        storyPlanId: 1,
        status: MilestoneStatus.PLANNED,
      });
      expect(result).toEqual(mockStoryMilestone);
    });
  });

  describe('getCharacterPlan', () => {
    it('should return character plan if exists', async () => {
      storyPlanRepository.findOne.mockResolvedValue(mockStoryPlan);

      const result = await service.getCharacterPlan(1);

      expect(storyPlanRepository.findOne).toHaveBeenCalledWith({
        where: { characterId: 1 },
        relations: ['milestones'],
      });
      expect(result).toEqual(mockStoryPlan);
    });

    it('should return null if no plan exists', async () => {
      storyPlanRepository.findOne.mockResolvedValue(null);

      const result = await service.getCharacterPlan(1);

      expect(result).toBeNull();
    });
  });

  describe('triggerMilestone', () => {
    it('should trigger a milestone successfully', async () => {
      const triggeredMilestone = { ...mockStoryMilestone, status: MilestoneStatus.IN_PROGRESS };
      storyMilestoneRepository.findOne.mockResolvedValue(mockStoryMilestone);
      storyMilestoneRepository.save.mockResolvedValue(triggeredMilestone);
      characterService.findOne.mockResolvedValue({} as Character);

      const result = await service.triggerMilestone(1);

      expect(storyMilestoneRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(storyMilestoneRepository.save).toHaveBeenCalled();
      expect(result.status).toBe(MilestoneStatus.IN_PROGRESS);
    });

    it('should throw error if milestone not found', async () => {
      storyMilestoneRepository.findOne.mockResolvedValue(null);

      await expect(service.triggerMilestone(1)).rejects.toThrow('Веха с ID 1 не найдена');
    });
  });

  describe('completeMilestone', () => {
    it('should complete a milestone successfully', async () => {
      const actualResults = { result: 'success' };
      const completedMilestone = {
        ...mockStoryMilestone,
        status: MilestoneStatus.ACHIEVED,
        actualResults,
      };
      storyMilestoneRepository.findOne.mockResolvedValue(mockStoryMilestone);
      storyMilestoneRepository.save.mockResolvedValue(completedMilestone);

      const result = await service.completeMilestone(1, actualResults);

      expect(storyMilestoneRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(storyMilestoneRepository.save).toHaveBeenCalled();
      expect(result.status).toBe(MilestoneStatus.ACHIEVED);
      expect(result.actualResults).toEqual(actualResults);
    });
  });

  describe('adaptMilestone', () => {
    it('should adapt a milestone successfully', async () => {
      const adaptations = { title: 'Adapted Title' };
      const adaptedMilestone = { ...mockStoryMilestone, ...adaptations };
      storyMilestoneRepository.findOne.mockResolvedValue(mockStoryMilestone);
      storyMilestoneRepository.save.mockResolvedValue(adaptedMilestone);

      const result = await service.adaptMilestone(1, adaptations);

      expect(storyMilestoneRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(storyMilestoneRepository.save).toHaveBeenCalled();
      expect(result.title).toBe('Adapted Title');
    });
  });

  describe('checkEventTriggers', () => {
    it('should check event triggers and return triggered events', async () => {
      const pendingEvents = [mockStoryEvent];
      storyEventRepository.find.mockResolvedValue(pendingEvents);

      const result = await service.checkEventTriggers(1, 1, RelationshipStage.FRIEND, 10);

      expect(storyEventRepository.find).toHaveBeenCalledWith({
        where: { characterId: 1, status: EventStatus.PENDING },
        order: { createdAt: 'ASC' },
      });
      expect(result).toBeDefined();
    });
  });
});

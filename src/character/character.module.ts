import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dialog } from '../dialog/entities/dialog.entity';
import { Message } from '../dialog/entities/message.entity';
// DialogModule не импортируется для избежания циклической зависимости
import { ErrorHandlingModule } from '../common/utils/error-handling/error-handling.module';
import { LoggingModule } from '../logging/logging.module';
import { CommonModule } from '../common/common.module';
import { LLMModule } from '../llm/llm.module';
import { PromptTemplateModule } from '../prompt-template/prompt-template.module';
import { UserModule } from '../user/user.module';

import { CharacterController } from './controllers/character.controller';

import { ICharacterModule } from '../common/interfaces';

// Entities
import { Character } from './entities/character.entity';
import { CharacterMemory } from './entities/character-memory.entity';
import { Need } from './entities/need.entity';
import { Action } from './entities/action.entity';
import { StoryEvent } from './entities/story-event.entity';
import { StoryPlan, StoryMilestone } from './entities/story-plan.entity';
import { CharacterMotivation } from './entities/character-motivation.entity';

// Unified Management Service
import { CharacterManagementService } from './services/character-management.service';

// Core Services
import { CharacterService } from './services/character.service';
import { NeedsService } from './services/needs.service';
import { MotivationService } from './services/motivation.service';

// Behavior Services
import { EmotionalStateService } from './services/emotional-state.service';
import { CharacterBehaviorService } from './services/character-behavior.service';
import { ActionService } from './services/action.service';

// Communication Services
import { MemoryService } from './services/memory.service';
import { MessageAnalysisService } from './services/message-analysis.service';
import { CharacterResponseService } from './services/character-response.service';


// Specialization Services
import { SpecializationService } from './services/specialization.service';

// Manipulation Services
import { ManipulationService } from './services/manipulation.service';
import { TechniqueExecutorService } from './services/technique-executor.service';



// Story Integration
import { StoryController } from './controllers/story.controller';
import { StoryModule } from './story.module';
import { forwardRef } from '@nestjs/common';

// Manipulation Entities
import {
  TechniqueExecution,
  UserManipulationProfile,
} from './entities/manipulation-technique.entity';

/**
 * Основной модуль персонажей - объединяет всю функциональность character
 */
@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([
      Character,
      CharacterMemory,
      Need,
      Action,
      StoryEvent,
      StoryPlan,
      StoryMilestone,
      CharacterMotivation,
      Dialog,
      Message,
      TechniqueExecution,
      UserManipulationProfile,
    ]),

    // External modules
    UserModule,
    CommonModule,
    ErrorHandlingModule,
    LoggingModule,
    LLMModule,
    PromptTemplateModule,
    forwardRef(() => StoryModule),
  ],
  controllers: [CharacterController, StoryController],
  providers: [
    // Unified Management Service
    CharacterManagementService,

    // Core Services
    CharacterService,
    MemoryService,
    NeedsService,
    MotivationService,

    EmotionalStateService,
    CharacterBehaviorService,

    // Action Services
    ActionService,

    // Analysis Services
    MessageAnalysisService,
    CharacterResponseService,

    // Specialization Services
    SpecializationService,

    // Manipulation Services
    ManipulationService,
    TechniqueExecutorService,

    // Context Services

    // Story Services
  ],
  exports: [
    // Unified Management Service
    CharacterManagementService,

    // Core Services
    CharacterService,
    MemoryService,
    NeedsService,
    MotivationService,
    EmotionalStateService,
    CharacterBehaviorService,

    // Action Services
    ActionService,

    // Analysis Services
    MessageAnalysisService,
    CharacterResponseService,

    // Specialization Services
    SpecializationService,

    // Manipulation Services
    ManipulationService,
    TechniqueExecutorService,

    // Context Services

    // Story Services
  ],
})
export class CharacterModule implements ICharacterModule {
  readonly id = 'character-module';
  readonly name = 'Character Module';
  readonly settings = {
    behaviorEnabled: true,
    emotionsEnabled: true,
    memoriesEnabled: true,
    needsEnabled: true,
  };
}

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
import { CacheModule } from '../cache/cache.module';
import { UserModule } from '../user/user.module';

import { CharacterController } from './controllers/character.controller';
import { SpecializationController } from './controllers/specialization.controller';
import { StoryController } from './controllers/story.controller';
import { TechniqueAnalyticsController } from './controllers/technique-analytics.controller';
import { EmotionalStateController } from './controllers/emotional-state.controller';

import { ICharacterModule } from '../common/interfaces';

// Entities
import { Character } from './entities/character.entity';
import { CharacterMemory } from './entities/character-memory.entity';
import { Need } from './entities/need.entity';
import { Action } from './entities/action.entity';
import { StoryEvent } from './entities/story-event.entity';
import { StoryPlan, StoryMilestone } from './entities/story-plan.entity';
import { CharacterMotivation } from './entities/character-motivation.entity';

// Core Services
import { CharacterManagementService } from './services/core/character-management.service';
import { CharacterService } from './services/core/character.service';
import { NeedsService } from './services/core/needs.service';
import { MotivationService } from './services/core/motivation.service';
import { EmotionalStateService } from './services/core/emotional-state.service';
import { MemoryService } from './services/core/memory.service';
import { CharacterResponseService } from './services/core/character-response.service';
import { MessageProcessingCoordinator } from './services/core/message-processing-coordinator.service';
import { SpecializationService } from './services/core/specialization.service';
import { CharacterSchedulerService } from './services/core/character-scheduler.service';
import { CharacterMonitoringService } from './services/core/character-monitoring.service';

// Action Services
import { ActionLifecycleService } from './services/action/action-lifecycle.service';
import { ActionSchedulerService } from './services/action/action-scheduler.service';
import { ActionResourceService } from './services/action/action-resource.service';
import { ActionGeneratorService } from './services/action/action-generator.service';
import { ActionExecutorService } from './services/action/action-executor.service';

// Behavior Services
import { CharacterBehaviorService } from './services/behavior/character-behavior.service';
import { FrustrationManagementService } from './services/behavior/frustration-management.service';
import { BehaviorPatternService } from './services/behavior/behavior-pattern.service';
import { EmotionalBehaviorService } from './services/behavior/emotional-behavior.service';
import { MessageBehaviorService } from './services/behavior/message-behavior.service';

// Analysis Services
import { ContextCompressionService } from './services/analysis/context-compression.service';
import { MessageAnalysisService } from './services/analysis/message-analysis.service';

// Manipulation Services
import { ManipulationService } from './services/manipulation/manipulation.service';

// Technique Services
import { TechniqueExecutorService } from './services/technique/technique-executor.service';
import { TechniqueStrategyService } from './services/technique/technique-strategy.service';
import { TechniqueHistoryService } from './services/technique/technique-history.service';

// Story Integration
import { StoryModule } from './story.module';
import { forwardRef } from '@nestjs/common';

// Manipulation Entities
import {
  TechniqueExecution,
  UserManipulationProfile,
} from './entities/manipulation-technique.entity';

// Repositories (временно отключен CharacterRepository из-за конфликтов с тестами)
// import { CharacterRepository } from './repositories/character.repository';
import { TechniqueExecutionRepository } from './repositories/technique-execution.repository';
import { UserManipulationProfileRepository } from './repositories/user-manipulation-profile.repository';

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
    CacheModule,
    forwardRef(() => StoryModule),
  ],
  controllers: [
    CharacterController,
    StoryController,
    TechniqueAnalyticsController,
    SpecializationController,
    EmotionalStateController,
  ],
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
    FrustrationManagementService,
    BehaviorPatternService,
    EmotionalBehaviorService,

    // Action Services
    ActionLifecycleService,
    ActionSchedulerService,
    ActionResourceService,
    ActionGeneratorService,
    ActionExecutorService,

    // Analysis Services
    MessageAnalysisService,
    MessageBehaviorService,
    CharacterResponseService,
    MessageProcessingCoordinator,

    // Specialization Services
    SpecializationService,

    // Manipulation Services
    ManipulationService,
    TechniqueExecutorService,
    TechniqueStrategyService,
    TechniqueHistoryService,

    // Context Services
    ContextCompressionService,

    // Story Services

    // Repositories (временно отключен CharacterRepository из-за конфликтов с тестами)
    // CharacterRepository,
    TechniqueExecutionRepository,
    UserManipulationProfileRepository,

    // Message Processing Services
    MessageProcessingCoordinator,

    // Scheduler Services
    CharacterSchedulerService,

    // Monitoring Services
    CharacterMonitoringService,
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
    FrustrationManagementService,
    BehaviorPatternService,
    EmotionalBehaviorService,

    // Action Services
    ActionLifecycleService,
    ActionSchedulerService,
    ActionResourceService,
    ActionGeneratorService,
    ActionExecutorService,

    // Analysis Services
    MessageAnalysisService,
    MessageBehaviorService,
    CharacterResponseService,
    MessageProcessingCoordinator,

    // Specialization Services
    SpecializationService,

    // Manipulation Services
    ManipulationService,
    TechniqueExecutorService,
    TechniqueStrategyService,
    TechniqueHistoryService,

    // Context Services
    ContextCompressionService,

    // Story Services

    // Repositories (временно отключен CharacterRepository из-за конфликтов с тестами)
    // CharacterRepository,
    TechniqueExecutionRepository,
    UserManipulationProfileRepository,

    // Scheduler Services
    CharacterSchedulerService,

    // Monitoring Services
    CharacterMonitoringService,
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

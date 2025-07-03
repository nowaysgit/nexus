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
import { ActionLifecycleService } from './services/action-lifecycle.service';
import { ActionSchedulerService } from './services/action-scheduler.service';
import { ActionResourceService } from './services/action-resource.service';
import { ActionGeneratorService } from './services/action-generator.service';
import { ActionExecutorService } from './services/action-executor.service';
import { FrustrationManagementService } from './services/frustration-management.service';
import { BehaviorPatternService } from './services/behavior-pattern.service';
import { EmotionalBehaviorService } from './services/emotional-behavior.service';

// Communication Services
import { MemoryService } from './services/memory.service';
import { MessageAnalysisService } from './services/message-analysis.service';
import { MessageBehaviorService } from './services/message-behavior.service';
import { CharacterResponseService } from './services/character-response.service';
import { ContextCompressionService } from './services/context-compression.service';
import { MessageProcessingCoordinator } from './services/message-processing-coordinator.service';

// Specialization Services
import { SpecializationService } from './services/specialization.service';

// Manipulation Services
import { ManipulationService } from './services/manipulation.service';
import { TechniqueExecutorService } from './services/technique-executor.service';
import { TechniqueStrategyService } from './services/technique-strategy.service';
import { TechniqueValidatorService } from './services/technique-validator.service';
import { TechniqueAnalyzerService } from './services/technique-analyzer.service';
import { TechniqueGeneratorService } from './services/technique-generator.service';
import { TechniqueAdapterService } from './services/technique-adapter.service';
import { TechniqueHistoryService } from './services/technique-history.service';

// Scheduler Services
import { CharacterSchedulerService } from './services/character-scheduler.service';

// Monitoring Services
import { CharacterMonitoringService } from './services/character-monitoring.service';

// Story Integration
import { StoryController } from './controllers/story.controller';
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
    FrustrationManagementService,
    BehaviorPatternService,
    EmotionalBehaviorService,

    // Action Services
    ActionService,
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
    TechniqueValidatorService,
    TechniqueAnalyzerService,
    TechniqueGeneratorService,
    TechniqueAdapterService,
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
    ActionService,
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
    TechniqueValidatorService,
    TechniqueAnalyzerService,
    TechniqueGeneratorService,
    TechniqueAdapterService,
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

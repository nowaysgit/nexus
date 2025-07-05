import { Module } from '@nestjs/common';
import { MessageProcessingCoordinator } from './services/core/message-processing-coordinator.service';
import { MessageAnalysisService } from './services/analysis/message-analysis.service';
import { NeedsService } from './services/core/needs.service';
import { CharacterBehaviorService } from './services/behavior/character-behavior.service';
import { CharacterResponseService } from './services/core/character-response.service';
import { EmotionalStateService } from './services/core/emotional-state.service';
import { ManipulationService } from './services/manipulation/manipulation.service';
import { TechniqueExecutorService } from './services/technique/technique-executor.service';
import { ActionExecutorService } from './services/action/action-executor.service';
import { MemoryService } from './services/core/memory.service';
import { CharacterService } from './services/core/character.service';
import { DialogModule } from '../dialog/dialog.module';
import { LLMModule } from '../llm/llm.module';
import { PromptTemplateModule } from '../prompt-template/prompt-template.module';
import { UserModule } from '../user/user.module';
import { LoggingModule } from '../logging/logging.module';
import { CommonModule } from '../common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Need } from './entities/need.entity';
import { Character } from './entities/character.entity';
import { CharacterMemory } from './entities/character-memory.entity';
import {
  TechniqueExecution,
  UserManipulationProfile,
} from './entities/manipulation-technique.entity';
import { Action } from './entities/action.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Need,
      Character,
      CharacterMemory,
      TechniqueExecution,
      UserManipulationProfile,
      Action,
    ]),
    DialogModule,
    LLMModule,
    PromptTemplateModule,
    UserModule,
    LoggingModule,
    CommonModule,
  ],
  providers: [
    MessageProcessingCoordinator,
    MessageAnalysisService,
    NeedsService,
    CharacterBehaviorService,
    CharacterResponseService,
    EmotionalStateService,
    ManipulationService,
    TechniqueExecutorService,
    ActionExecutorService,
    MemoryService,
    CharacterService,
  ],
  exports: [MessageProcessingCoordinator],
})
export class MessageProcessingModule {}

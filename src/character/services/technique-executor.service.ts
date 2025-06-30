import { Injectable } from '@nestjs/common';
import { BaseService } from '../../common/base/base.service';
import { LogService } from '../../logging/log.service';
import { 
  ITechniqueContext, 
  ITechniqueResult, 
  ManipulativeTechniqueType, 
  TechniqueIntensity,
  TechniquePhase 
} from '../interfaces/technique.interfaces';
import { TechniqueValidatorService } from './technique-validator.service';
import { TechniqueAdapterService } from './technique-adapter.service';
import { TechniqueGeneratorService } from './technique-generator.service';
import { TechniqueAnalyzerService } from './technique-analyzer.service';
import { TechniqueHistoryService } from './technique-history.service';

/**
 * Координирующий сервис для выполнения манипулятивных техник
 */
@Injectable()
export class TechniqueExecutorService extends BaseService {
  constructor(
    protected readonly logService: LogService,
    private readonly validatorService: TechniqueValidatorService,
    private readonly adapterService: TechniqueAdapterService,
    private readonly generatorService: TechniqueGeneratorService,
    private readonly analyzerService: TechniqueAnalyzerService,
    private readonly historyService: TechniqueHistoryService,
  ) {
    super(logService);
  }

  async executeTechnique(
    techniqueType: ManipulativeTechniqueType,
    intensity: TechniqueIntensity,
  TechniquePhase,
    context: ITechniqueContext,
    phase: TechniquePhase = TechniquePhase.EXECUTION,
  ): Promise<ITechniqueResult> {
    return {
      success: true,
      techniqueType,
      intensity,
      message: 'Базовая реализация',
      effectiveness: 50,
      ethicalScore: 50,
      sideEffects: [],
      phase,
    };
  }

  async canExecuteTechnique(
    techniqueType: ManipulativeTechniqueType,
    intensity: TechniqueIntensity,
  TechniquePhase,
    context: ITechniqueContext,
  ): Promise<{ allowed: boolean; reason?: string }> {
    return { allowed: true };
  }

  async getTechniqueStatistics(
    characterId: string,
    techniqueType?: ManipulativeTechniqueType,
  ): Promise<{ totalExecutions: number; averageEffectiveness: number; averageEthicalScore: number; commonSideEffects: string[] }> {
    return {
      totalExecutions: 0,
      averageEffectiveness: 0,
      averageEthicalScore: 0,
      commonSideEffects: [],
    };
  }

  async getTechniqueHistory(
    characterId: string,
    limit: number = 10,
  ): Promise<ITechniqueResult[]> {
    return [];
  }
}

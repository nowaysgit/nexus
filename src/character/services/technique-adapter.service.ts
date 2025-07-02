import { Injectable } from '@nestjs/common';
import { BaseService } from '../../common/base/base.service';
import { LogService } from '../../logging/log.service';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
  ITechniqueContext,
} from '../interfaces/technique.interfaces';

@Injectable()
export class TechniqueAdapterService extends BaseService {
  constructor(protected readonly logService: LogService) {
    super(logService);
  }

  async adaptTechniqueToProfile(
    _techniqueType: ManipulativeTechniqueType,
    _characterId: string,
    context: ITechniqueContext,
  ): Promise<{
    adaptedIntensity: TechniqueIntensity;
    adaptedContext: ITechniqueContext;
    appliedAdaptations: string[];
  }> {
    return {
      adaptedIntensity: TechniqueIntensity.MEDIUM,
      adaptedContext: context,
      appliedAdaptations: [],
    };
  }
}

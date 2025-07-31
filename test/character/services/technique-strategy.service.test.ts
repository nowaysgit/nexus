import { Test, TestingModule } from '@nestjs/testing';
import { TechniqueStrategyService } from '../../../src/character/services/technique/technique-strategy.service';
import { LogService } from '../../../src/logging/log.service';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
} from '../../../src/character/enums/technique.enums';

describe('TechniqueStrategyService', () => {
  let service: TechniqueStrategyService;

  beforeEach(async () => {
    const mockLogService = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TechniqueStrategyService, { provide: LogService, useValue: mockLogService }],
    }).compile();

    service = module.get<TechniqueStrategyService>(TechniqueStrategyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize execution strategies on construction', () => {
    const strategies = service.getAllStrategies();
    expect(strategies.size).toBeGreaterThan(0);

    // Проверяем наличие основных техник
    expect(strategies.has(ManipulativeTechniqueType.PUSH_PULL)).toBe(true);
    expect(strategies.has(ManipulativeTechniqueType.GRADUAL_INVOLVEMENT)).toBe(true);
    expect(strategies.has(ManipulativeTechniqueType.EXCLUSIVITY_ILLUSION)).toBe(true);
    expect(strategies.has(ManipulativeTechniqueType.VALIDATION)).toBe(true);
  });

  describe('getStrategy', () => {
    it('should return strategy for existing technique type', () => {
      const strategy = service.getStrategy(ManipulativeTechniqueType.PUSH_PULL);

      expect(strategy).toBeDefined();
      expect(strategy?.techniqueType).toBe(ManipulativeTechniqueType.PUSH_PULL);
      expect(strategy?.promptTemplate).toContain('горячо-холодно');
      expect(strategy?.ethicalConstraints).toBeDefined();
      expect(strategy?.contextRequirements).toBeDefined();
    });

    it('should return undefined for non-existing technique type', () => {
      const strategy = service.getStrategy('NON_EXISTING_TYPE' as ManipulativeTechniqueType);
      expect(strategy).toBeUndefined();
    });

    it('should return strategy with proper intensity modifiers', () => {
      const strategy = service.getStrategy(ManipulativeTechniqueType.VALIDATION);

      expect(strategy?.intensityModifiers).toBeDefined();
      expect(strategy?.intensityModifiers[TechniqueIntensity.SUBTLE]).toBeDefined();
      expect(strategy?.intensityModifiers[TechniqueIntensity.MODERATE]).toBeDefined();
      expect(strategy?.intensityModifiers[TechniqueIntensity.MEDIUM]).toBeDefined();
      expect(strategy?.intensityModifiers[TechniqueIntensity.AGGRESSIVE]).toBeDefined();
    });
  });

  describe('getAllStrategies', () => {
    it('should return a copy of all strategies', () => {
      const strategies1 = service.getAllStrategies();
      const strategies2 = service.getAllStrategies();

      expect(strategies1).not.toBe(strategies2); // Должны быть разные объекты
      expect(strategies1.size).toBe(strategies2.size);
    });

    it('should include all expected technique types', () => {
      const strategies = service.getAllStrategies();

      const expectedTechniques = [
        ManipulativeTechniqueType.PUSH_PULL,
        ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
        ManipulativeTechniqueType.EXCLUSIVITY_ILLUSION,
        ManipulativeTechniqueType.GASLIGHTING,
        ManipulativeTechniqueType.EMOTIONAL_BLACKMAIL,
        ManipulativeTechniqueType.ISOLATION,
        ManipulativeTechniqueType.CONSTANT_VALIDATION,
        ManipulativeTechniqueType.TROJAN_HORSE,
        ManipulativeTechniqueType.SNOWBALL,
        ManipulativeTechniqueType.TRIANGULATION,
        ManipulativeTechniqueType.LOVE_BOMBING,
        ManipulativeTechniqueType.VALIDATION,
      ];

      expectedTechniques.forEach(technique => {
        expect(strategies.has(technique)).toBe(true);
      });
    });
  });

  describe('getAffectedParameters', () => {
    it('should return base parameters for technique without intensity', () => {
      const parameters = service.getAffectedParameters(ManipulativeTechniqueType.VALIDATION);

      expect(Array.isArray(parameters)).toBe(true);
      expect(parameters.length).toBeGreaterThanOrEqual(0);
    });

    it('should include additional parameters for aggressive intensity', () => {
      const parameters = service.getAffectedParameters(
        ManipulativeTechniqueType.PUSH_PULL,
        TechniqueIntensity.AGGRESSIVE,
      );

      expect(parameters).toContain('стрессовые_реакции');
      expect(parameters).toContain('защитные_механизмы');
    });

    it('should include emotional stability for medium intensity', () => {
      const parameters = service.getAffectedParameters(
        ManipulativeTechniqueType.GRADUAL_INVOLVEMENT,
        TechniqueIntensity.MEDIUM,
      );

      expect(parameters).toContain('эмоциональная_стабильность');
    });

    it('should return empty array for non-existing technique', () => {
      const parameters = service.getAffectedParameters('NON_EXISTING' as ManipulativeTechniqueType);

      expect(parameters).toEqual([]);
    });
  });

  describe('strategy validation', () => {
    it('should have valid ethical constraints for all strategies', () => {
      const strategies = service.getAllStrategies();

      strategies.forEach((strategy, _techniqueType) => {
        expect(strategy.ethicalConstraints.maxUsagePerHour).toBeGreaterThan(0);
        expect(strategy.ethicalConstraints.cooldownMinutes).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(strategy.ethicalConstraints.bannedCombinations)).toBe(true);
      });
    });

    it('should have valid context requirements for all strategies', () => {
      const strategies = service.getAllStrategies();

      strategies.forEach((strategy, _techniqueType) => {
        expect(strategy.contextRequirements.minRelationshipLevel).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(strategy.contextRequirements.requiredEmotionalStates)).toBe(true);
        expect(Array.isArray(strategy.contextRequirements.forbiddenStates)).toBe(true);
      });
    });

    it('should have proper intensity modifiers range for all strategies', () => {
      const strategies = service.getAllStrategies();

      strategies.forEach((strategy, _techniqueType) => {
        Object.values(strategy.intensityModifiers).forEach(modifier => {
          expect(modifier).toBeGreaterThanOrEqual(0);
          expect(modifier).toBeLessThanOrEqual(1);
        });
      });
    });
  });
});

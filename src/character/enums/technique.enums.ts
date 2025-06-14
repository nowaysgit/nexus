/**
 * Типы манипулятивных техник
 */
export enum ManipulativeTechniqueType {
  PUSH_PULL = 'push_pull',
  GRADUAL_INVOLVEMENT = 'gradual_involvement',
  EXCLUSIVITY_ILLUSION = 'exclusivity_illusion',
  EMOTIONAL_BLACKMAIL = 'emotional_blackmail',
  ISOLATION = 'isolation',
  CONSTANT_VALIDATION = 'constant_validation',
  TROJAN_HORSE = 'trojan_horse',
  GASLIGHTING = 'gaslighting',
  SNOWBALL = 'snowball',
  TRIANGULATION = 'triangulation',
  LOVE_BOMBING = 'love_bombing',
  VALIDATION = 'validation'
}

/**
 * Интенсивность применения техники
 */
export enum TechniqueIntensity {
  SUBTLE = 'subtle',
  MODERATE = 'moderate',
  MEDIUM = 'medium',
  AGGRESSIVE = 'aggressive'
}

/**
 * Фаза применения техники
 */
export enum TechniquePhase {
  PREPARATION = 'preparation',
  EXECUTION = 'execution',
  DEVELOPMENT = 'development',
  MONITORING = 'monitoring',
  COMPLETION = 'completion',
  COOLDOWN = 'cooldown'
}
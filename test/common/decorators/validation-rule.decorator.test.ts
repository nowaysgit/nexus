/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
// Отключение ESLint правил для тестов декораторов валидации из-за сложности типизации
// рефлексии метаданных и динамических функций валидации

import {
  ValidationRule,
  getValidationRules,
  MessageTemplateDefinition,
} from '../../../src/common/decorators/validation-rule.decorator';
import 'reflect-metadata';

describe('ValidationRule Decorator', () => {
  class TestValidationClass {
    @ValidationRule('message_type_1')
    rule1() {
      return { type: 'rule1', validate: () => true };
    }

    @ValidationRule('message_type_2', 10)
    rule2() {
      return { type: 'rule2', validate: () => false };
    }

    @ValidationRule('message_type_1', 5)
    rule3() {
      return { type: 'rule3', validate: () => true };
    }

    @MessageTemplateDefinition()
    getTemplate() {
      return 'Test template: {message}';
    }
  }

  describe('ValidationRule decorator', () => {
    it('should register validation rules with metadata', () => {
      const rules = getValidationRules(TestValidationClass);

      expect(rules).toHaveLength(3);
      expect(rules[0].messageType).toBe('message_type_1');
      expect(rules[0].priority).toBeUndefined();
      expect(rules[1].messageType).toBe('message_type_2');
      expect(rules[1].priority).toBe(10);
      expect(rules[2].messageType).toBe('message_type_1');
      expect(rules[2].priority).toBe(5);
    });

    it('should create rule factories that return correct values', () => {
      const rules = getValidationRules(TestValidationClass);
      const instance = new TestValidationClass();

      const rule1Result = rules[0].ruleFactory.call(instance);
      expect(rule1Result).toEqual({ type: 'rule1', validate: expect.any(Function) });

      const rule2Result = rules[1].ruleFactory.call(instance);
      expect(rule2Result).toEqual({ type: 'rule2', validate: expect.any(Function) });
    });

    it('should preserve original method functionality', () => {
      const instance = new TestValidationClass();

      const result1 = instance.rule1();
      expect(result1.type).toBe('rule1');
      expect(result1.validate()).toBe(true);

      const result2 = instance.rule2();
      expect(result2.type).toBe('rule2');
      expect(result2.validate()).toBe(false);
    });

    it('should handle multiple rules for same message type', () => {
      const rules = getValidationRules(TestValidationClass);
      const messageType1Rules = rules.filter(rule => rule.messageType === 'message_type_1');

      expect(messageType1Rules).toHaveLength(2);
      expect(messageType1Rules[0].priority).toBeUndefined();
      expect(messageType1Rules[1].priority).toBe(5);
    });
  });

  describe('getValidationRules function', () => {
    it('should return empty array for class without rules', () => {
      class EmptyClass {}

      const rules = getValidationRules(EmptyClass);
      expect(rules).toEqual([]);
    });

    it('should return rules for class with rules', () => {
      const rules = getValidationRules(TestValidationClass);
      expect(rules).toHaveLength(3);
    });
  });

  describe('MessageTemplateDefinition decorator', () => {
    it('should register template metadata', () => {
      const templateMetadata = Reflect.getMetadata('validation:template', TestValidationClass);

      expect(templateMetadata).toBeDefined();
      expect(templateMetadata.getTemplate).toBeDefined();
    });

    it('should preserve original method functionality', () => {
      const instance = new TestValidationClass();
      const result = instance.getTemplate();

      expect(result).toBe('Test template: {message}');
    });

    it('should create template getter that works with context', () => {
      const templateMetadata = Reflect.getMetadata('validation:template', TestValidationClass);
      const instance = new TestValidationClass();

      const templateResult = templateMetadata.getTemplate.call(instance);
      expect(templateResult).toBe('Test template: {message}');
    });
  });

  describe('integration scenarios', () => {
    it('should work with inheritance', () => {
      class BaseValidationClass {
        @ValidationRule('base_message')
        baseRule() {
          return { type: 'base', validate: () => true };
        }
      }

      class ExtendedValidationClass extends BaseValidationClass {
        @ValidationRule('extended_message')
        extendedRule() {
          return { type: 'extended', validate: () => false };
        }
      }

      const baseRules = getValidationRules(BaseValidationClass);
      const extendedRules = getValidationRules(ExtendedValidationClass);

      // Проверяем что базовый класс имеет правило для base_message
      expect(baseRules.some(rule => rule.messageType === 'base_message')).toBe(true);

      // В наследовании метаданные могут накапливаться, проверим что есть правило для extended
      expect(extendedRules.length).toBeGreaterThanOrEqual(1);
      expect(extendedRules.some(rule => rule.messageType === 'extended_message')).toBe(true);
      expect(extendedRules.some(rule => rule.messageType === 'base_message')).toBe(true);
    });

    it('should handle complex rule factories', () => {
      class ComplexValidationClass {
        private config = { strictMode: true };

        @ValidationRule('complex_message')
        complexRule() {
          return {
            type: 'complex',
            config: this.config,
            validate: (value: any) => (this.config.strictMode ? value !== null : true),
          };
        }
      }

      const rules = getValidationRules(ComplexValidationClass);
      const instance = new ComplexValidationClass();

      const ruleResult = rules[0].ruleFactory.call(instance);
      expect(ruleResult.type).toBe('complex');
      expect(ruleResult.config.strictMode).toBe(true);
      expect(ruleResult.validate(null)).toBe(false);
      expect(ruleResult.validate('test')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle rules with undefined priority', () => {
      class UndefinedPriorityClass {
        @ValidationRule('test_message', undefined)
        testRule() {
          return { type: 'test' };
        }
      }

      const rules = getValidationRules(UndefinedPriorityClass);
      expect(rules[0].priority).toBeUndefined();
    });

    it('should handle rules with zero priority', () => {
      class ZeroPriorityClass {
        @ValidationRule('test_message', 0)
        testRule() {
          return { type: 'test' };
        }
      }

      const rules = getValidationRules(ZeroPriorityClass);
      expect(rules[0].priority).toBe(0);
    });

    it('should handle empty message type', () => {
      class EmptyMessageTypeClass {
        @ValidationRule('')
        emptyRule() {
          return { type: 'empty' };
        }
      }

      const rules = getValidationRules(EmptyMessageTypeClass);
      expect(rules[0].messageType).toBe('');
    });
  });
});

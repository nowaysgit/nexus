import { TestConfigurations } from '../../../../lib/tester/test-configurations';

// Создаем моки модулей для тестов
class DialogModule {}
class OtherModule {}

describe('TestConfigurations', () => {
  describe('containsDialogModule', () => {
    it('should return true when DialogModule is present', () => {
      expect(TestConfigurations.containsDialogModule([DialogModule])).toBe(true);
    });

    it('should return false when DialogModule is not present', () => {
      expect(TestConfigurations.containsDialogModule([OtherModule])).toBe(false);
    });

    it('should handle empty array', () => {
      expect(TestConfigurations.containsDialogModule([])).toBe(false);
    });

    it('should handle undefined input', () => {
      expect(TestConfigurations.containsDialogModule(undefined)).toBe(false);
    });
  });

  describe('requiredMocksAdder', () => {
    it('should add UserService mock when DialogModule is present', () => {
      const imports = [DialogModule];
      const providers = [];

      const result = TestConfigurations.requiredMocksAdder(imports, providers);

      expect(result.some(p => (p as any)?.provide === 'UserService')).toBe(true);
    });

    it('should not add UserService mock when DialogModule is not present', () => {
      const imports = [OtherModule];
      const providers = [];

      const result = TestConfigurations.requiredMocksAdder(imports, providers);

      expect(result.some(p => (p as any)?.provide === 'UserService')).toBe(false);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should not duplicate UserService mock if already present', () => {
      const imports = [DialogModule];
      const providers = [
        {
          provide: 'UserService',
          useValue: { customMock: true },
        },
      ];

      const result = TestConfigurations.requiredMocksAdder(imports, providers);

      const userServices = result.filter(p => (p as any)?.provide === 'UserService');
      expect(userServices.length).toBe(1);
      expect((userServices[0] as any).useValue.customMock).toBe(true);
    });
  });
});

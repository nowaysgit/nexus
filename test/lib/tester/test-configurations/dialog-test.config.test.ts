import {
  getDialogTestConfig,
  addMockUserServiceToProviders,
} from '../../../../lib/tester/test-configurations/dialog-test.config';
import { mockUserService } from '../../../../lib/tester/mocks/user-service.mock';

describe('DialogTestConfig', () => {
  describe('getDialogTestConfig', () => {
    it('should return a valid test configuration', () => {
      const config = getDialogTestConfig();

      expect(config).toHaveProperty('type', 'integration');
      expect(config).toHaveProperty('database', true);
      expect(config).toHaveProperty('providers');

      const userServiceProvider = config.providers.find(p => (p as any).provide === 'UserService');
      expect(userServiceProvider).toBeDefined();
      expect((userServiceProvider as any).useValue).toBe(mockUserService);
    });
  });

  describe('addMockUserServiceToProviders', () => {
    it('should add mockUserService if it does not exist', () => {
      const providers = [{ provide: 'OtherService', useValue: {} }];
      const result = addMockUserServiceToProviders(providers);
      expect(result).toHaveLength(2);
      expect(result.some(p => (p as any).provide === 'UserService')).toBe(true);
    });

    it('should not add mockUserService if it already exists', () => {
      const providers = [{ provide: 'UserService', useValue: { custom: true } }];
      const result = addMockUserServiceToProviders(providers);
      expect(result).toHaveLength(1);
      expect((result[0] as any).useValue.custom).toBe(true);
    });
  });
});

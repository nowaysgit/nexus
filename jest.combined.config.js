module.exports = {
  projects: [
    // Модульные тесты
    {
      displayName: 'Unit Tests',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src', '<rootDir>/lib'],
      testMatch: [
        '**/__tests__/**/*.(t|j)s',
        '**/*.(test|spec).(t|j)s',
        '!**/*.integration.(test|spec).(t|j)s'
      ],
      transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
      },
      collectCoverageFrom: [
        'src/**/*.(t|j)s',
        'lib/**/*.(t|j)s',
        '!src/**/*.spec.ts',
        '!src/**/*.test.ts',
        '!src/**/*.integration.test.ts',
        '!src/**/*.e2e-spec.ts',
        '!src/main.ts',
        '!**/node_modules/**',
      ],
      coverageDirectory: './coverage',
      forceExit: true,
      testTimeout: 90000, // Дополнительно увеличиваем timeout для unit тестов
    },
    // Интеграционные тесты
    {
      displayName: 'Integration Tests',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/test'],
      testMatch: [
        '**/*.integration.(test|spec).(t|j)s',
        '**/test/**/*.(test|spec).(t|j)s'
      ],
      transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
      },
      setupFilesAfterEnv: ['<rootDir>/test/setup-integration.ts'],
      forceExit: true,
      testTimeout: 120000, // Увеличиваем timeout для интеграционных тестов
      maxWorkers: 1, // Интеграционные тесты выполняются последовательно
    }
  ],
  // Общие настройки для всех проектов
  collectCoverage: true,
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  bail: false, // Продолжаем выполнение даже если некоторые тесты упали
}; 
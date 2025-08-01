module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testRegex: '.*\\.integration\\.test\\.ts$',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    collectCoverageFrom: ['**/*.(t|j)s'],
    coverageDirectory: './coverage-integration',
    testEnvironment: 'node',
    roots: ['<rootDir>/src/', '<rootDir>/test/'],
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
        '^test/(.*)$': '<rootDir>/test/$1',
    },
    setupFilesAfterEnv: ['<rootDir>/test/setup-integration.ts'],
    // Отключаем проверку типов для ускорения тестов
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig.json',
            skipTypeCheck: true,
        },
    },
    // Убираем устаревшие Jest опции
    testTimeout: 120000, // Правильная Jest опция для timeout
    // Уменьшаем вывод для ускорения
    verbose: false,
    // Обнаружение открытых хендлов
    detectOpenHandles: true,
    // Уменьшаем количество воркеров для стабильности PostgreSQL подключений
    maxWorkers: 1,
    // Включаем кеш для ускорения повторных запусков
    cache: true,
    cacheDirectory: '<rootDir>/.jest-integration-cache',
    // Очистка моков между тестами
    clearMocks: true,
    resetMocks: false,
    restoreMocks: false,
    // Остановка после первой ошибки для быстрого фидбека
    bail: false,
    // Модули для игнорирования
    modulePathIgnorePatterns: [
        '<rootDir>/dist/',
        '<rootDir>/node_modules/',
        '<rootDir>/coverage/',
    ],
    // Настройки для работы с PostgreSQL
    testEnvironmentOptions: {
        url: 'postgresql://test_user:test_password@localhost:5433/nexus_test',
    },
    // Ограничение конкурентности для PostgreSQL
    maxConcurrency: 1,
    silent: false,
    // Дополнительные настройки для оптимизации
    slowTestThreshold: 60,
    // Повторные попытки для нестабильных тестов
    retry: 1,
}; 
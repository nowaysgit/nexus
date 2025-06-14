module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    collectCoverageFrom: [
        'src/**/*.(t|j)s',
        '!src/**/*.spec.ts',
        '!src/**/*.test.ts',
    ],
    coverageDirectory: '../coverage',
    testTimeout: 60000, // 60 секунд для интеграционных тестов
    setupFilesAfterEnv: ['<rootDir>/test/setup-integration.ts'],
    // Принудительное завершение Jest
    forceExit: true,
    // Обнаружение открытых хендлов
    detectOpenHandles: true,
    // Максимальное количество воркеров
    maxWorkers: 1,
    // Отключаем кеш для интеграционных тестов
    cache: false,
    // Очистка моков между тестами
    clearMocks: true,
    restoreMocks: true,
    resetMocks: true,
    // Настройки для TypeScript
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
    },
    // Переменные окружения для интеграционных тестов
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig.json',
        },
    },
}; 
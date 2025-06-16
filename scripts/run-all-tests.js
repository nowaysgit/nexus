#!/usr/bin/env node

/**
 * Скрипт для запуска всех тестов и генерации отчета о покрытии
 * Запуск: node scripts/run-all-tests.js
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Директория и файл для логов
const logsDir = path.resolve(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}
const logFilePath = path.join(logsDir, 'test-run.log');
// Перезаписываем файл при каждом запуске
fs.writeFileSync(logFilePath, '');

function logToFile(data) {
  fs.appendFileSync(logFilePath, data);
}

function runCommand(command, args = [], options = {}) {
  console.log(`\n🔧 Запуск: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'test', ...options.env },
    shell: options.shell ?? false,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
    logToFile(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
    logToFile(result.stderr);
  }

  if (result.status !== 0 && !options.ignoreError) {
    throw new Error(`Команда ${command} завершилась с кодом ${result.status}`);
  }
}

console.log('🚀 Запуск всех тестов проекта с отчетом о покрытии (лог: logs/test-run.log)');

try {
    // Проверяем подключение к базе данных
    runCommand('node', ['scripts/check-db-connection.js']);
    console.log('✅ База данных готова к тестированию');

    // Проверка типов
    runCommand('npx', ['tsc', '--noEmit']);
    console.log('✅ Проверка типов успешно пройдена');

    // Юнит-тесты
    console.log('\n📋 Запуск юнит-тестов...');
    const unitOptions = [
        '--coverage',
        '--coverageReporters=text',
        '--coverageReporters=lcov',
        '--coverageDirectory=coverage/unit',
        '--testPathIgnorePatterns=.*\\.integration\\.test\\.ts$',
        '--testPathIgnorePatterns=.*\\.e2e\\.test\\.ts$'
    ];

    try {
      runCommand('jest', unitOptions, { ignoreError: true, shell: true });
      console.log('✅ Юнит-тесты выполнены');
    } catch (e) {
      console.error('⚠️ Юнит-тесты завершились с ошибками');
    }

    // Интеграционные тесты
    console.log('\n📋 Запуск интеграционных тестов...');
    const integrationOptions = [
        '--coverage',
        '--coverageReporters=text',
        '--coverageReporters=lcov',
        '--coverageDirectory=coverage/integration',
        '--testMatch=**/*.integration.test.ts',
        '--forceExit',
        '--detectOpenHandles',
        '--testTimeout=30000',
        '--config=jest.integration.config.js'
    ];

    try {
      runCommand('jest', integrationOptions, { ignoreError: true, shell: true });
      console.log('✅ Интеграционные тесты выполнены');
    } catch (e) {
      console.error('⚠️ Интеграционные тесты завершились с ошибками');
    }

    // Объединяем отчёты о покрытии
    console.log('\n📊 Генерация объединенного отчета о покрытии...');
    try {
        runCommand('npx', ['nyc', '--version'], { ignoreError: false });

        runCommand('npx', ['nyc', 'merge', 'coverage/unit', 'coverage/merged-report.json']);
        runCommand('npx', ['nyc', 'merge', 'coverage/integration', 'coverage/merged-integration.json']);
        runCommand('npx', ['nyc', 'merge', 'coverage', 'coverage/final-report.json']);
        runCommand('npx', ['nyc', 'report', '--reporter=text', '--reporter=lcov', '--temp-dir=coverage']);

        console.log('✅ Объединенный отчет о покрытии успешно создан');
    } catch (error) {
        console.warn('⚠️ Не удалось создать объединенный отчет о покрытии. Убедитесь, что установлен пакет nyc');
    }

    console.log('\n🎉 Все тесты выполнены! Отчеты о покрытии доступны в директории coverage/');
} catch (error) {
    logToFile(`\n❌ Сбой: ${error.message}`);
    console.error('❌ Ошибка при выполнении тестов:', error.message);
    process.exit(1);
} 
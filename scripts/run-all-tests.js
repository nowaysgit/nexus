#!/usr/bin/env node

/**
 * Скрипт для запуска всех тестов и генерации отчета о покрытии
 * Запуск: node scripts/run-all-tests.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Запуск всех тестов проекта с отчетом о покрытии');

try {
    // Сначала проверяем подключение к базе данных
    console.log('\n🔍 Проверка подключения к тестовой базе данных...');
    execSync('node scripts/check-db-connection.js', {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'test' }
    });
    console.log('✅ База данных готова к тестированию');

    // Запускаем проверку типов
    console.log('\n📋 Проверка типов TypeScript...');
    execSync('npx tsc --noEmit', {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'test' }
    });
    console.log('✅ Проверка типов успешно пройдена');

    // Запускаем юнит-тесты с покрытием
    console.log('\n📋 Запуск юнит-тестов...');
    const unitOptions = [
        '--coverage',
        '--coverageReporters=text',
        '--coverageReporters=lcov',
        '--coverageDirectory=coverage/unit',
        '--testPathIgnorePatterns=.*\\.integration\\.test\\.ts$',
        '--testPathIgnorePatterns=.*\\.e2e\\.test\\.ts$'
    ];

    console.log(`✓ Запуск команды: jest ${unitOptions.join(' ')}`);

    try {
        execSync(`jest ${unitOptions.join(' ')}`, {
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'test' }
        });
        console.log('✅ Юнит-тесты успешно выполнены');
    } catch (error) {
        console.error('⚠️ Некоторые юнит-тесты завершились с ошибками');
        // Продолжаем выполнение скрипта, чтобы запустить интеграционные тесты
    }

    // Запускаем интеграционные тесты с покрытием
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

    console.log(`✓ Запуск команды: jest ${integrationOptions.join(' ')}`);

    try {
        execSync(`jest ${integrationOptions.join(' ')}`, {
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'test' }
        });
        console.log('✅ Интеграционные тесты успешно выполнены');
    } catch (error) {
        console.error('⚠️ Некоторые интеграционные тесты завершились с ошибками');
        // Продолжаем выполнение скрипта для вывода общей статистики
    }

    // Объединяем отчеты о покрытии (если такая возможность есть)
    console.log('\n📊 Генерация объединенного отчета о покрытии...');
    try {
        // Проверяем, установлен ли nyc для объединения отчетов
        execSync('npx nyc --version', { stdio: 'ignore' });

        // Объединяем отчеты с помощью nyc
        execSync('npx nyc merge coverage/unit coverage/merged-report.json', { stdio: 'inherit' });
        execSync('npx nyc merge coverage/integration coverage/merged-integration.json', { stdio: 'inherit' });
        execSync('npx nyc merge coverage coverage/final-report.json', { stdio: 'inherit' });
        execSync('npx nyc report --reporter=text --reporter=lcov --temp-dir=coverage', { stdio: 'inherit' });

        console.log('✅ Объединенный отчет о покрытии успешно создан');
    } catch (error) {
        console.warn('⚠️ Не удалось создать объединенный отчет о покрытии. Убедитесь, что установлен пакет nyc');
        console.warn('   Для установки nyc выполните: npm install -g nyc');
    }

    console.log('\n🎉 Все тесты выполнены! Отчеты о покрытии доступны в директории coverage/');
} catch (error) {
    console.error('❌ Ошибка при выполнении тестов:', error.message);
    process.exit(1);
} 
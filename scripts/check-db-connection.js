#!/usr/bin/env node

/**
 * Скрипт для проверки подключения к тестовой базе данных
 * Запуск: node scripts/check-db-connection.js
 */

const { Client } = require('pg');
const { execSync } = require('child_process');

async function checkDatabaseConnection() {
  const client = new Client({
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
    user: process.env.TEST_DB_USERNAME || 'test_user',
    password: process.env.TEST_DB_PASSWORD || 'test_password',
    database: process.env.TEST_DB_NAME || 'nexus_test',
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к тестовой базе данных:', error.message);
    try {
      await client.end();
    } catch (e) {
      // Игнорируем ошибку при закрытии соединения
    }
    return false;
  }
}

async function waitForDatabaseConnection(maxRetries = 5, retryInterval = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    if (i > 0) {
      console.log(`Попытка подключения к базе данных ${i + 1}/${maxRetries}...`);
    }
    
    const isConnected = await checkDatabaseConnection();
    if (isConnected) {
      return true;
    }
    
    if (i < maxRetries - 1) {
      console.log(`Ожидание ${retryInterval / 1000} секунд перед следующей попыткой...`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
  
  console.error(`❌ Не удалось подключиться к базе данных после ${maxRetries} попыток`);
  return false;
}

async function startDatabaseContainer() {
  console.log('🚀 Запуск контейнеров с тестовым окружением...');
  try {
    // Пробуем использовать docker compose (новый синтаксис)
    execSync('docker compose -f docker-compose.test.yml up -d', { stdio: 'inherit' });
  } catch (error) {
    try {
      // Если не сработало, пробуем docker-compose (старый синтаксис)
      console.log('Пробуем использовать docker-compose (старый синтаксис)...');
      execSync('docker-compose -f docker-compose.test.yml up -d', { stdio: 'inherit' });
    } catch (composeError) {
      console.error('❌ Не удалось запустить контейнеры с тестовым окружением.');
      console.error('Пожалуйста, запустите их вручную:');
      console.error('docker compose -f docker-compose.test.yml up -d');
      return false;
    }
  }
  
  console.log('✅ Контейнеры с тестовым окружением запущены');
  console.log('⏳ Ожидание готовности базы данных...');
  
  // Ждем, пока база данных будет готова
  return waitForDatabaseConnection(10, 3000);
}

async function main() {
  console.log('🔍 Проверка подключения к тестовой базе данных...');
  
  // Сначала пробуем подключиться
  const isConnected = await checkDatabaseConnection();
  
  if (isConnected) {
    console.log('✅ База данных доступна, можно запускать тесты');
    process.exit(0);
  } else {
    console.log('❌ База данных недоступна, пробуем запустить контейнеры...');
    
    // Если не удалось подключиться, пробуем запустить контейнеры
    const started = await startDatabaseContainer();
    
    if (started) {
      console.log('✅ Тестовое окружение готово, можно запускать тесты');
      process.exit(0);
    } else {
      console.error('❌ Не удалось подготовить тестовое окружение');
      console.error('Пожалуйста, убедитесь, что Docker запущен и выполните:');
      console.error('docker compose -f docker-compose.test.yml up -d');
      process.exit(1);
    }
  }
}

// Запускаем основную функцию
main().catch(error => {
  console.error('❌ Произошла ошибка:', error);
  process.exit(1);
}); 
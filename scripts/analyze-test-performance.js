#!/usr/bin/env node
/**
 * Скрипт для анализа производительности тестов с использованием разных оптимизаций
 * 
 * Запускает тесты с разными конфигурациями и сравнивает время выполнения
 * 
 * Использование:
 * node scripts/analyze-test-performance.js [options]
 * 
 * Опции:
 * --test-file <path> - путь к файлу теста для анализа
 * --iterations <number> - количество итераций для каждой конфигурации (по умолчанию 3)
 * --all - запустить анализ для всех тестов
 * --sqlite - использовать SQLite вместо PostgreSQL
 * --postgres - использовать PostgreSQL (по умолчанию)
 * --optimization-types - типы оптимизаций для тестирования (через запятую)
 * 
 * Примеры:
 * node scripts/analyze-test-performance.js --test-file test/character/action.service.test.ts --iterations 5
 * node scripts/analyze-test-performance.js --all --sqlite
 * node scripts/analyze-test-performance.js --optimization-types cache,batch,cleanup
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Парсинг аргументов командной строки
const args = process.argv.slice(2);
const options = {
  testFile: null,
  iterations: 3,
  all: false,
  sqlite: false,
  postgres: true,
  optimizationTypes: ['cache', 'batch', 'cleanup', 'connection', 'transaction', 'compatibility'],
};

// Обработка аргументов
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case '--test-file':
      options.testFile = args[++i];
      break;
    case '--iterations':
      options.iterations = parseInt(args[++i], 10);
      break;
    case '--all':
      options.all = true;
      break;
    case '--sqlite':
      options.sqlite = true;
      options.postgres = false;
      break;
    case '--postgres':
      options.postgres = true;
      options.sqlite = false;
      break;
    case '--optimization-types':
      options.optimizationTypes = args[++i].split(',');
      break;
    default:
      console.error(`Неизвестный аргумент: ${arg}`);
      process.exit(1);
  }
}

// Проверка аргументов
if (!options.testFile && !options.all) {
  console.error('Необходимо указать путь к файлу теста (--test-file) или использовать флаг --all');
  process.exit(1);
}

// Конфигурации для тестирования
const configurations = [
  { name: 'Базовая (без оптимизаций)', env: { DISABLE_ALL_OPTIMIZATIONS: 'true' } },
];

// Добавление конфигураций для каждого типа оптимизации
options.optimizationTypes.forEach(type => {
  configurations.push({
    name: `С оптимизацией ${type}`,
    env: { [`ENABLE_${type.toUpperCase()}_OPTIMIZATION`]: 'true' },
  });
});

// Добавление конфигурации со всеми оптимизациями
configurations.push({
  name: 'Все оптимизации',
  env: { ENABLE_ALL_OPTIMIZATIONS: 'true' },
});

// Функция для запуска теста с заданной конфигурацией
function runTest(testFile, config, iteration) {
  console.log(`Запуск теста ${testFile} с конфигурацией "${config.name}" (итерация ${iteration + 1}/${options.iterations})`);
  
  const env = {
    ...process.env,
    ...config.env,
    ...(options.sqlite ? { USE_SQLITE: 'true' } : {}),
  };
  
  const startTime = Date.now();
  
  try {
    execSync(`yarn jest ${testFile} --silent`, { env });
    const endTime = Date.now();
    return endTime - startTime;
  } catch (error) {
    console.error(`Ошибка при запуске теста: ${error.message}`);
    return null;
  }
}

// Функция для получения списка тестовых файлов
function getTestFiles() {
  if (options.testFile) {
    return [options.testFile];
  }
  
  // Поиск всех тестовых файлов
  const testDir = path.join(__dirname, '..', 'test');
  const files = [];
  
  function scanDir(dir) {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const itemPath = path.join(dir, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        scanDir(itemPath);
      } else if (stats.isFile() && item.endsWith('.test.ts')) {
        files.push(itemPath);
      }
    });
  }
  
  scanDir(testDir);
  return files;
}

// Функция для анализа результатов
function analyzeResults(results) {
  const testFiles = Object.keys(results);
  const summaryTable = [];
  
  testFiles.forEach(testFile => {
    const testResults = results[testFile];
    const baselineConfig = configurations[0].name;
    const baselineTime = testResults[baselineConfig].avg;
    
    const row = {
      testFile: path.relative(path.join(__dirname, '..'), testFile),
      baseline: baselineTime,
    };
    
    Object.keys(testResults).forEach(configName => {
      if (configName !== baselineConfig) {
        const configTime = testResults[configName].avg;
        const improvement = ((baselineTime - configTime) / baselineTime) * 100;
        row[configName] = {
          time: configTime,
          improvement: improvement.toFixed(2),
        };
      }
    });
    
    summaryTable.push(row);
  });
  
  return summaryTable;
}

// Функция для вывода результатов в консоль
function printResults(summaryTable) {
  console.log('\n=== Результаты анализа производительности тестов ===\n');
  
  summaryTable.forEach(row => {
    console.log(`Тест: ${row.testFile}`);
    console.log(`Базовое время выполнения: ${row.baseline} мс`);
    
    Object.keys(row).forEach(key => {
      if (key !== 'testFile' && key !== 'baseline') {
        const result = row[key];
        const improvementText = result.improvement > 0
          ? `улучшение на ${result.improvement}%`
          : `ухудшение на ${Math.abs(result.improvement)}%`;
        
        console.log(`${key}: ${result.time} мс (${improvementText})`);
      }
    });
    
    console.log('---');
  });
}

// Функция для сохранения результатов в файл
function saveResults(summaryTable) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const dbType = options.sqlite ? 'sqlite' : 'postgres';
  const filename = `test-performance-${dbType}-${timestamp}.json`;
  const filePath = path.join(__dirname, '..', filename);
  
  fs.writeFileSync(filePath, JSON.stringify({
    timestamp,
    dbType,
    configurations,
    results: summaryTable,
  }, null, 2));
  
  console.log(`Результаты сохранены в файл: ${filename}`);
  
  // Обновление сводного файла
  const summaryPath = path.join(__dirname, '..', 'test-performance-summary.md');
  let summaryContent = '';
  
  if (fs.existsSync(summaryPath)) {
    summaryContent = fs.readFileSync(summaryPath, 'utf8');
  }
  
  // Добавление новых результатов в сводный файл
  summaryContent += `\n## Анализ производительности от ${new Date().toLocaleString()}\n\n`;
  summaryContent += `- База данных: ${dbType}\n`;
  summaryContent += `- Количество итераций: ${options.iterations}\n`;
  summaryContent += `- Типы оптимизаций: ${options.optimizationTypes.join(', ')}\n\n`;
  
  summaryContent += '| Тест | Базовое время (мс) | Все оптимизации (мс) | Улучшение |\n';
  summaryContent += '|------|-------------------|----------------------|----------|\n';
  
  summaryTable.forEach(row => {
    const allOptimizations = row['Все оптимизации'];
    summaryContent += `| ${row.testFile} | ${row.baseline} | ${allOptimizations.time} | ${allOptimizations.improvement}% |\n`;
  });
  
  fs.writeFileSync(summaryPath, summaryContent);
  console.log(`Сводная информация обновлена в файле: test-performance-summary.md`);
}

// Основная функция
async function main() {
  console.log('=== Анализ производительности тестов ===');
  console.log(`База данных: ${options.sqlite ? 'SQLite' : 'PostgreSQL'}`);
  console.log(`Количество итераций: ${options.iterations}`);
  console.log(`Типы оптимизаций: ${options.optimizationTypes.join(', ')}`);
  console.log('');
  
  const testFiles = getTestFiles();
  console.log(`Найдено тестовых файлов: ${testFiles.length}`);
  
  const results = {};
  
  // Запуск тестов для каждого файла и каждой конфигурации
  for (const testFile of testFiles) {
    results[testFile] = {};
    
    for (const config of configurations) {
      const times = [];
      
      for (let i = 0; i < options.iterations; i++) {
        const time = runTest(testFile, config, i);
        if (time !== null) {
          times.push(time);
        }
      }
      
      if (times.length > 0) {
        const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        
        results[testFile][config.name] = { times, avg, min, max };
      }
    }
  }
  
  // Анализ и вывод результатов
  const summaryTable = analyzeResults(results);
  printResults(summaryTable);
  saveResults(summaryTable);
}

main().catch(error => {
  console.error('Ошибка при выполнении анализа:', error);
  process.exit(1);
}); 
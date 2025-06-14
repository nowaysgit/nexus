-- Инициализация тестовой базы данных
-- Этот скрипт выполняется при создании контейнера с тестовой БД

-- Создаем дополнительные расширения если нужно
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Создаем схему для тестов если нужно
-- CREATE SCHEMA IF NOT EXISTS test_schema;

-- Настройки для тестовой БД
ALTER DATABASE nexus_test SET timezone TO 'UTC';

-- Комментарий о назначении БД
COMMENT ON DATABASE nexus_test IS 'Тестовая база данных для Nexus приложения'; 
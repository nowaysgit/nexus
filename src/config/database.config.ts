import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'nexus',
  synchronize: process.env.DATABASE_SYNCHRONIZE === 'true' || false,
  logging: process.env.DATABASE_LOGGING === 'true' || false,
}));

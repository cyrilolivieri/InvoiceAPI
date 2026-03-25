import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../models/schema.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Neon serverless driver — postgres-js with connection pooling
const client = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

export type DB = typeof db;

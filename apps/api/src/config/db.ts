import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max:             20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

db.on('error', (err) => {
  console.error('[DB] Unexpected pool error', err);
  process.exit(-1);
});

export const connectDB = async (): Promise<void> => {
  const client = await db.connect();
  try {
    await client.query('SELECT 1');
    console.log('[DB] PostgreSQL connected');
  } finally {
    client.release();
  }
};

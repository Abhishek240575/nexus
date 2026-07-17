import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max:                    5,
  idleTimeoutMillis:      10000,
  connectionTimeoutMillis: 10000,
});

// Don't exit on pool errors - Neon serverless connections drop frequently
db.on('error', (err) => {
  console.error('[DB] Pool error (non-fatal):', err.message);
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

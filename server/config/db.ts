import { Pool, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';
const requiresSsl = Boolean(
  connectionString && (
    connectionString.includes('render.com') ||
    connectionString.includes('neon.tech') ||
    connectionString.includes('supabase.co') ||
    connectionString.includes('sslmode=require') ||
    process.env.DB_SSL === 'true'
  )
);

export const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: requiresSsl ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'Lakshay@123',
        database: process.env.DB_NAME || 'BroadcastEngine',
        ssl: isProduction && process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

export const query = async <T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (process.env.DEBUG_SQL === 'true') {
    console.log('Executed query', { text, duration, rows: res.rowCount });
  }
  return res;
};

export default {
  pool,
  query,
};

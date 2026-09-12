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
        max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 15,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        statement_timeout: 45000,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'Lakshay@123',
        database: process.env.DB_NAME || 'BroadcastEngine',
        ssl: isProduction && process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 15,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        statement_timeout: 45000,
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
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 1500 && process.env.NODE_ENV !== 'test') {
      console.warn(`⚠️ Slow query warning (${duration}ms):`, text.slice(0, 150));
    }
    return res;
  } catch (err: any) {
    console.error(`❌ DB Query failed (${Date.now() - start}ms):`, { query: text.slice(0, 150), error: err.message });
    throw err;
  }
};

export default {
  pool,
  query,
};

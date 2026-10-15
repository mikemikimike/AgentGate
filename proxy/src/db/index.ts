import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.AG_DB_URL,
  max: 20,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

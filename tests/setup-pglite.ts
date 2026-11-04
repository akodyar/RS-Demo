import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

export async function injectPgliteMock() {
  const pglite = new PGlite();
  const migDb = drizzlePglite(pglite);
  await migrate(migDb, { migrationsFolder: './drizzle' });

  const pglitePool: any = {
    connect: async () => {
      return {
        query: async (queryArg: any, paramsArg?: any) => {
          const sql = typeof queryArg === 'string' ? queryArg : queryArg.text;
          const values = typeof queryArg === 'string' ? paramsArg : (queryArg.values || paramsArg);
          const rowMode = queryArg?.rowMode;
          const res = await pglite.query(sql, values || [], rowMode ? { rowMode } : undefined);
          return { rows: res.rows, rowCount: res.rows.length, fields: res.fields };
        },
        release: () => {},
      };
    },
    query: async (queryArg: any, paramsArg?: any) => {
      const sql = typeof queryArg === 'string' ? queryArg : queryArg.text;
      const values = typeof queryArg === 'string' ? paramsArg : (queryArg.values || paramsArg);
      const rowMode = queryArg?.rowMode;
      const res = await pglite.query(sql, values || [], rowMode ? { rowMode } : undefined);
      return { rows: res.rows, rowCount: res.rows.length, fields: res.fields };
    },
    on: () => {},
    end: async () => {},
  };

  process.env.SQL_HOST = '127.0.0.1';
  process.env.SQL_DB_NAME = 'homehub';
  process.env.DATABASE_URL = 'postgres://fake:fake@127.0.0.1/fake';
  (global as any)._postgresPool = pglitePool;

  try {
    const { resetDbHealthCache } = await import('../src/server/middleware/dbGuard.js');
    resetDbHealthCache();
  } catch (e) {}

  return pglite;
}

import "server-only";
import path from "node:path";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { CrmError } from "./permissions";

export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(text: string): Promise<void>;
}
export interface Database extends Sql {
  transaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
const globalDb = globalThis as unknown as { cohamyCrmDatabase?: Promise<Database> };

export function database(): Promise<Database> {
  if (!globalDb.cohamyCrmDatabase) globalDb.cohamyCrmDatabase = openDatabase().catch(error => {
    globalDb.cohamyCrmDatabase = undefined;
    throw error;
  });
  return globalDb.cohamyCrmDatabase;
}

async function openDatabase(): Promise<Database> {
  if (process.env.CRM_DATABASE_MODE === "pglite") {
    // This adapter is a labelled, single-process LOCAL harness, not a production database.
    if (process.env.NODE_ENV === "production" || process.env.CRM_ENVIRONMENT !== "LOCAL") {
      throw new CrmError("EMBEDDED_DATABASE_LOCAL_ONLY", 503);
    }
    const relative = process.env.CRM_LOCAL_DATA_DIR;
    if (!relative || path.isAbsolute(relative) || !/^\.local[/\\]crm[A-Za-z0-9_-]+$/u.test(relative)) throw new CrmError("CRM_LOCAL_PATH_INVALID", 503);
    const resolved = path.resolve(relative);
    // Exact two-part path validation above excludes traversal. Avoid a static
    // path.resolve('.local') pattern: tracing would bundle all local QA databases.
    const db = new PGlite(resolved);
    await db.waitReady;
    return {
      query: (text, params) => db.query(text, params),
      exec: async text => { await db.exec(text); },
      transaction: fn => db.transaction(tx => fn({ query: (text, params) => tx.query(text, params), exec: async text => { await tx.exec(text); } })),
      close: () => db.close(),
    };
  }
  if (!process.env.CRM_DATABASE_URL) throw new CrmError("CRM_DATABASE_NOT_CONFIGURED", 503);
  const pool = new Pool({ connectionString: process.env.CRM_DATABASE_URL, max: 8, connectionTimeoutMillis: 5000 });
  return {
    async query<T>(text: string, params?: unknown[]) { return { rows: (await pool.query(text, params)).rows as T[] }; },
    async exec(text: string) { await pool.query(text); },
    async transaction<T>(fn: (sql: Sql) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const value = await fn({ async query<T>(text: string, params?: unknown[]) { return { rows: (await client.query(text, params)).rows as T[] }; }, async exec(text: string) { await client.query(text); } });
        await client.query("COMMIT");
        return value;
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
    close: () => pool.end(),
  };
}

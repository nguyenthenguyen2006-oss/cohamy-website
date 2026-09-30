/** The only PostgreSQL database that demo tooling may write to. */
export const DEMO_DATABASE_NAME = 'cohamy_crm_demo';

export function assertDemoPostgresUrl(connectionString: string | undefined): void {
  if (!connectionString) throw new Error('DEMO_DATABASE_URL_REQUIRED');

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DEMO_DATABASE_URL_INVALID');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username) {
    throw new Error('DEMO_DATABASE_URL_INVALID');
  }

  // Check the database component, never the username, password, host or query.
  if (decodeURIComponent(url.pathname.slice(1)) !== DEMO_DATABASE_NAME) {
    throw new Error(`DEMO_DATABASE_TARGET_NOT_ALLOWED: expected ${DEMO_DATABASE_NAME}`);
  }
}

export async function assertConnectedDemoPostgresDatabase(
  query: (sql: string) => Promise<{ rows: Array<{ name: string }> }>,
): Promise<void> {
  const actual = (await query('SELECT current_database() AS name')).rows[0]?.name;
  if (actual !== DEMO_DATABASE_NAME) {
    throw new Error(`DEMO_DATABASE_CONNECTION_MISMATCH: expected ${DEMO_DATABASE_NAME}`);
  }
}

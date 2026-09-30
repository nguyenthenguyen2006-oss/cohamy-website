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

/** One-off fixture seed into the live CRM, never a general DEMO-mode bypass. */
export function assertProductionFixtureSeedTarget(connectionString: string | undefined, confirmation: string | undefined): void {
  if (!connectionString) throw new Error('PRODUCTION_FIXTURE_DATABASE_URL_REQUIRED');
  let url: URL;
  try { url = new URL(connectionString); }
  catch { throw new Error('PRODUCTION_FIXTURE_DATABASE_URL_INVALID'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.hostname !== '127.0.0.1' ||
      url.username !== 'cohamy_owner' ||
      !/^\d{2,5}$/.test(url.port) ||
      decodeURIComponent(url.pathname.slice(1)) !== 'cohamy_crm' ||
      url.search || url.hash) {
    throw new Error('PRODUCTION_FIXTURE_DATABASE_TARGET_NOT_ALLOWED');
  }
  if (confirmation !== `seed-demo-into-cohamy_crm@${url.hostname}:${url.port}`) {
    throw new Error('PRODUCTION_FIXTURE_CONFIRMATION_MISMATCH');
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

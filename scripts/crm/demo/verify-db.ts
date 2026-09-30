import 'server-only';
import assert from 'node:assert/strict';
import { database } from '@/lib/crm/db';

process.env.CRM_DATABASE_MODE = process.env.CRM_DATABASE_MODE || 'pglite';
process.env.CRM_ENVIRONMENT = process.env.CRM_ENVIRONMENT || 'DEMO';
process.env.CRM_LOCAL_DATA_DIR = process.env.CRM_LOCAL_DATA_DIR || '.local/crm-demo';

async function verifyDatabaseConnection() {
  console.log('=================================================');
  console.log(' [COHAMY CRM] XÁC MINH KẾT NỐI DATABASE DEMO    ');
  console.log('=================================================');

  const mode = process.env.CRM_DATABASE_MODE || 'pglite';
  const env = process.env.CRM_ENVIRONMENT || 'DEMO';
  const dbUrl = process.env.CRM_DATABASE_URL || '';
  const localDir = process.env.CRM_LOCAL_DATA_DIR || '.local/crm-demo';

  console.log(`- Môi trường (CRM_ENVIRONMENT): ${env}`);
  console.log(`- Chế độ Database (CRM_DATABASE_MODE): ${mode}`);
  console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

  if (env !== 'DEMO') {
    throw new Error(`CRITICAL: CRM_ENVIRONMENT must be 'DEMO', but received '${env}'`);
  }

  const db = await database();

  try {
    const meta = (
      await db.query<{
        current_database: string;
        current_user?: string;
        version: string;
        server_addr?: string;
        server_port?: number;
      }>(
        `SELECT 
           current_database() AS current_database,
           current_user AS current_user,
           version() AS version`
      )
    ).rows[0];

    console.log('\n--- THÔNG TIN KẾT NỐI THỰC TẾ TỪ SERVER ---');
    console.log(`- Database Name : ${meta.current_database}`);
    console.log(`- Database User : ${meta.current_user || 'embedded'}`);
    console.log(`- Engine Version: ${meta.version}`);

    if (mode === 'postgres') {
      console.log(`- Connection URL: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
      
      // Strict safety validation: NEVER allow production database
      const forbidden = ['cohamy', 'cohamy_crm', 'cohamy_prod', 'cohamy_production'];
      const dbLower = meta.current_database.toLowerCase();
      if (forbidden.includes(dbLower)) {
        throw new Error(
          `FATAL SAFETY VIOLATION: Server is connected to protected production database '${meta.current_database}'!`
        );
      }

      if (!dbLower.includes('demo')) {
        throw new Error(
          `DEMO ALLOWLIST VIOLATION: Database '${meta.current_database}' does not contain 'demo'. Must use dedicated demo database (e.g. 'cohamy_crm_demo').`
        );
      }

      console.log('✅ XÁC NHẬN: Database đích nằm trong allowlist demo và hoàn toàn tách biệt khỏi database production.');
    } else {
      console.log(`- Local Storage : ${localDir}`);
      assert.ok(localDir.includes('demo'), 'Local data dir must contain demo');
      console.log('✅ XÁC NHẬN: Sử dụng bộ lưu trữ nhúng cục bộ độc lập .local/crm-demo.');
    }

    // Verify CRM schema tables
    const tableCountRow = (
      await db.query<{ n: string }>(
        `SELECT count(*)::text AS n 
         FROM information_schema.tables 
         WHERE table_schema = 'cohamy_crm'`
      )
    ).rows[0];

    const tableCount = parseInt(tableCountRow?.n || '0', 10);
    console.log(`- Tổng số bảng schema 'cohamy_crm': ${tableCount} bảng`);
    assert.ok(tableCount >= 40, `CRM schema must have at least 40 tables, found ${tableCount}`);

    console.log('\n=================================================');
    console.log(' ✅ XÁC MINH HOÀN TẤT: SERVER KẾT NỐI ĐÚNG DATABASE DEMO!');
    console.log('=================================================');
  } finally {
    await db.close().catch(() => {});
  }
}

verifyDatabaseConnection()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('VERIFY_DATABASE_CONNECTION_FAILED:', err);
    process.exit(1);
  });

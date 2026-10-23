import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { database, type Database } from '../../lib/crm/db';
import { audit, membershipPrincipal } from '../../lib/crm/auth';
import { roles } from '../../lib/crm/types';
import { can } from '../../lib/crm/permissions';
import { listInternalDocuments, downloadInternalDocument, uploadInternalDocument } from '../../lib/crm/internal-documents';

async function main() {
  assert.equal(process.env.CRM_ENVIRONMENT, 'PRODUCTION'); assert.equal(process.env.CRM_DATABASE_MODE, 'postgres');
  const target = new URL(process.env.CRM_DATABASE_URL ?? '');
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname) && target.port === '55432' && target.pathname === '/cohamy_crm', 'VERIFIED_COHAMY_DATABASE_REQUIRED');
  const [fixturePath, output] = process.argv.slice(2); assert.ok(fixturePath && output);
  const fixture = z.object({ title: z.string().regex(/^KIỂM THỬ HỆ THỐNG · Tài liệu nội bộ · [a-f0-9-]{36}$/), description: z.literal('Tệp kiểm tra tạm thời do quy trình triển khai tạo; được dọn sau khi xác minh.'), filename: z.literal('Kiem-tra-tai-lieu-noi-bo.pdf'), uploadedBy: z.uuid(), checksum: z.string().regex(/^[a-f0-9]{64}$/), fileId: z.uuid() }).strict().parse(JSON.parse(await fs.readFile(fixturePath, 'utf8')));
  const db = await database(), cache = globalThis as unknown as { cohamyCrmDatabase?: Promise<Database> };
  const marker = randomUUID(), rollback = new Error('ROLLBACK_ONLY_DOCUMENT_ROLE_CHECKS'), cases: object[] = [];
  let complete = false, cleaned = false;
  const forbidden = (error: unknown) => (error as { status: number }).status === 403;
  try {
    const file = (await db.query<{ title: string; description: string; filename: string; uploaded_by: string; checksum: string }>('SELECT title,description,filename,uploaded_by,checksum FROM cohamy_crm.internal_documents WHERE id=$1', [fixture.fileId])).rows[0];
    assert.ok(file, 'SYNTHETIC_FIXTURE_REQUIRED');
    assert.equal(file.title, fixture.title); assert.equal(file.description, fixture.description); assert.equal(file.filename, fixture.filename); assert.equal(file.uploaded_by, fixture.uploadedBy); assert.equal(file.checksum, fixture.checksum);
    try {
      await db.transaction(async tx => {
        // The temporary identities never commit and are invisible to HTTP requests or other users.
        const scoped: Database = { ...tx, transaction: run => run(tx), close: async () => {} };
        cache.cohamyCrmDatabase = Promise.resolve(scoped);
        try {
          const organization = (await tx.query<{ id: string }>("SELECT o.id FROM cohamy_crm.organizations o JOIN cohamy_crm.memberships m ON m.organization_id=o.id WHERE m.user_id=$1 AND m.role='ADMIN' AND o.kind='COHAMY' LIMIT 1", [fixture.uploadedBy])).rows[0];
          assert.ok(organization);
          const dealer = randomUUID();
          await tx.query("INSERT INTO cohamy_crm.organizations(id,code,name,kind) VALUES ($1,$2,'Rollback-only document verification','DEALER')", [dealer, 'QA_INTERNAL_' + marker]);
          for (const role of roles) {
            const userId = randomUUID(), membership = randomUUID();
            await tx.query("INSERT INTO cohamy_crm.users(id,email,display_name,password_hash) VALUES ($1,$2,'Rollback-only document verification','NO_LOGIN_ROLLBACK_ONLY')", [userId, 'qa-internal-' + role.toLowerCase() + '-' + marker + '@crm-qa.invalid']);
            await tx.query('INSERT INTO cohamy_crm.memberships(id,user_id,organization_id,role) VALUES ($1,$2,$3,$4)', [membership, userId, role.startsWith('DEALER_') ? dealer : organization.id, role]);
            const user = await membershipPrincipal(membership, tx); assert.ok(user);
            const read = role === 'ACCOUNTANT' || role.startsWith('WAREHOUSE'), access = read || role === 'ADMIN';
            assert.equal(can(user, 'internal-documents.manage'), role === 'ADMIN');
            if (access) assert.equal((await listInternalDocuments(user, { q: fixture.title })).items.some(row => row.id === fixture.fileId), true);
            else await assert.rejects(listInternalDocuments(user), forbidden);
            if (read) {
              const result = await downloadInternalDocument(user, fixture.fileId);
              assert.equal(createHash('sha256').update(result.content).digest('hex'), fixture.checksum);
            } else await assert.rejects(downloadInternalDocument(user, fixture.fileId), forbidden);
            if (role !== 'ADMIN') await assert.rejects(uploadInternalDocument(user, {}), forbidden);
            cases.push({ role, catalogue: access ? 'ALLOWED' : 'FORBIDDEN', fileContents: read ? 'ALLOWED checksum verified' : 'FORBIDDEN', upload: role === 'ADMIN' ? 'ALLOWED verified through production Edge UI' : 'FORBIDDEN', status: 'PASS' });
          }
          throw rollback;
        } finally { cache.cohamyCrmDatabase = Promise.resolve(db); }
      });
    } catch (error) { if (error !== rollback) throw error; }
    assert.equal((await db.query<{ total: string }>('SELECT count(*)::text AS total FROM cohamy_crm.users WHERE email LIKE $1', ['qa-internal-%-' + marker + '@crm-qa.invalid'])).rows[0].total, '0');
    complete = true;
  } finally {
    cache.cohamyCrmDatabase = Promise.resolve(db);
    try {
      // Delete only the exact synthetic file this verification uploaded; retain the audit history.
      await db.transaction(async tx => {
        const removed = await tx.query<{ id: string }>('DELETE FROM cohamy_crm.internal_documents WHERE id=$1 AND title=$2 AND description=$3 AND filename=$4 AND uploaded_by=$5 AND checksum=$6 RETURNING id', [fixture.fileId, fixture.title, fixture.description, fixture.filename, fixture.uploadedBy, fixture.checksum]);
        assert.equal(removed.rows.length, 1, 'EXACT_SYNTHETIC_FIXTURE_REQUIRED_FOR_CLEANUP');
        await audit(tx, fixture.uploadedBy, 'internal-document.verification-cleaned', fixture.fileId, { reason: 'Removed only the temporary deployment verification PDF', checksum: fixture.checksum });
      });
      cleaned = true;
    } finally {
      await fs.writeFile(output, JSON.stringify({ environment: 'PRODUCTION PostgreSQL service role matrix', testedAt: new Date().toISOString(), scope: 'Real uploaded test file; temporary role identities exist only in a rolled-back transaction; no real accounts or business documents changed', status: complete && cleaned ? 'PASS' : 'FAIL', cases, temporaryIdentities: 'ROLLED BACK', syntheticFileRemoved: cleaned, auditHistory: 'RETAINED' }, null, 2) + '\n');
      await db.close();
    }
  }
  console.log(cases.length + ' production role checks passed; temporary identities rolled back; exact test file removed.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'PRODUCTION_DOCUMENT_CHECK_FAILED'); process.exitCode = 1; });

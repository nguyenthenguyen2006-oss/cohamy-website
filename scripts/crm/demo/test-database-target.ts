import assert from 'node:assert/strict';
import { assertDemoPostgresUrl } from '../../../lib/crm/demo-database-guard';

assert.doesNotThrow(() =>
  assertDemoPostgresUrl('postgresql://demo_owner:secret@127.0.0.1:55432/cohamy_crm_demo')
);

for (const url of [
  'postgresql://demo_owner:secret@127.0.0.1:55432/cohamy',
  'postgresql://demo_owner:secret@127.0.0.1:55432/cohamy_prod',
  'postgresql://owner:secret@demo.example/cohamy_crm',
  'postgresql://owner:secret@127.0.0.1:55432/other_demo',
  'https://demo.example/cohamy_crm_demo',
]) {
  assert.throws(() => assertDemoPostgresUrl(url), /DEMO_DATABASE_(TARGET_NOT_ALLOWED|URL_INVALID)/);
}

console.log('PASS: demo PostgreSQL guard checks the exact database name, not other URL components.');

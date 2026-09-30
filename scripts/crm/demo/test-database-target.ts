import assert from 'node:assert/strict';
import { assertDemoPostgresUrl, assertProductionFixtureSeedTarget } from '../../../lib/crm/demo-database-guard';

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

const liveUrl = 'postgresql://cohamy_owner:secret@127.0.0.1:55432/cohamy_crm';
assert.doesNotThrow(() => assertProductionFixtureSeedTarget(liveUrl, 'seed-demo-into-cohamy_crm@127.0.0.1:55432'));
for (const [url, confirmation] of [
  [liveUrl, 'wrong-target'],
  ['postgresql://cohamy_owner:secret@remote.example:55432/cohamy_crm', 'seed-demo-into-cohamy_crm@remote.example:55432'],
  ['postgresql://cohamy_owner:secret@127.0.0.1:55432/cohamy_crm_demo', 'seed-demo-into-cohamy_crm@127.0.0.1:55432'],
  ['postgresql://cohamy_runtime:secret@127.0.0.1:55432/cohamy_crm', 'seed-demo-into-cohamy_crm@127.0.0.1:55432'],
] as const) {
  assert.throws(() => assertProductionFixtureSeedTarget(url, confirmation), /PRODUCTION_FIXTURE_/);
}
console.log('PASS: live fixture seeding requires the owner, loopback production database and exact target token.');

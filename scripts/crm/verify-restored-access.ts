import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
if(process.env.CRM_ENVIRONMENT!=='STAGING'||!/^\/cohamy_restore_[a-z0-9_]+$/.test(new URL(process.env.CRM_DATABASE_URL??'').pathname))throw new Error('ISOLATED_RESTORE_QA_REQUIRED');
async function main(){const {database}=await import('../../lib/crm/db'),{membershipPrincipal}=await import('../../lib/crm/auth'),{downloadDocument}=await import('../../lib/crm/workspace'),{getOrganization}=await import('../../lib/crm/repository'),db=await database(),cases=[];
 try{const a=(await db.query<{id:string}>("SELECT m.id FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id WHERE u.email='a@crm-qa.invalid'")).rows[0],b=(await db.query<{id:string}>("SELECT m.id FROM cohamy_crm.memberships m JOIN cohamy_crm.users u ON u.id=m.user_id WHERE u.email='b@crm-qa.invalid'")).rows[0];if(!a||!b)throw new Error('RESTORED_FICTITIOUS_FIXTURE_REQUIRED');const dealerA=await membershipPrincipal(a.id),dealerB=await membershipPrincipal(b.id);assert.ok(dealerA&&dealerB);const file=(await db.query<{id:string}>('SELECT id FROM cohamy_crm.document_versions')).rows[0];assert.ok(file);
  assert.equal(Buffer.from((await downloadDocument(dealerA,file.id)).content).toString(),'%PDF-1.7\nSTAGING QA restore');cases.push({name:'Restored private file contains exact source bytes under dealer A scope',status:'PASS'});
  await assert.rejects(downloadDocument(dealerB,file.id),/NOT_FOUND/);cases.push({name:'Restored file download denies dealer B',status:'PASS'});
  await assert.rejects(getOrganization(dealerA,dealerB.organizationId),/NOT_FOUND/);cases.push({name:'Restored organization links retain A/B boundaries',status:'PASS'});
  const history=(await db.query<{count:string}>('SELECT count(*)::text AS count FROM cohamy_crm.custom_field_versions')).rows[0];assert.equal(history.count,'1');await assert.rejects(db.query("DELETE FROM cohamy_crm.custom_field_versions WHERE field_id IN(SELECT id FROM cohamy_crm.custom_field_definitions)"),/AUDIT_APPEND_ONLY/);cases.push({name:'Restored immutable definitions retain history protection',status:'PASS'});
  await fs.mkdir('reports',{recursive:true});await fs.writeFile('reports/restored-access.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'STAGING independent QA restore',status:'PASS',cases},null,2));console.log('PASS restored exact file bytes, A/B scope, links and immutable history');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'RESTORED_ACCESS_FAILED');process.exitCode=1;});

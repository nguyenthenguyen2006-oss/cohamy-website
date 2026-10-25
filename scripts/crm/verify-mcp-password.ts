import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
process.env.CRM_DATABASE_MODE='pglite';
process.env.CRM_ENVIRONMENT='LOCAL';
process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-mcp-password-'+randomUUID();
process.env.CRM_MFA_ENCRYPTION_KEY='LOCAL-QA-only-MCP-password-encryption-key';
process.env.CRM_EMAIL_ENABLED='false';
async function main(){
 const {createQaFixture,qaPassword}=await import('./qa-fixture');
 const auth=await import('../../lib/crm/auth'),security=await import('../../lib/crm/account-security');
 await createQaFixture();const db=await(await import('../../lib/crm/db')).database();
 const cases:{name:string;status:string}[]=[],check=async(name:string,run:()=>Promise<void>)=>{await run();cases.push({name,status:'PASS'});console.log('PASS '+name);};
 try{
  const admin=await auth.login('admin@crm-qa.invalid',qaPassword);
  const enrollment=await security.beginMfaEnrollment(admin.user,{password:qaPassword});
  await security.confirmMfaEnrollment(admin.user,{password:qaPassword,code:security.totp(enrollment.secret)});
  await check('MCP accepts the current Admin password with active MFA, without creating a browser session',async()=>{
   const before=(await db.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.sessions')).rows[0].n;
   assert.equal((await auth.verifyMcpAdminPassword('admin@crm-qa.invalid',qaPassword)).id,admin.user.id);
   assert.equal((await db.query<{n:string}>('SELECT count(*)::text AS n FROM cohamy_crm.sessions')).rows[0].n,before);
   assert.equal((await security.mfaStatus(admin.user)).enabled,true);
  });
  await check('Ordinary CRM login still requires the configured second factor',async()=>{
   await assert.rejects(auth.login('admin@crm-qa.invalid',qaPassword),/MFA_REQUIRED/);
   const logged=await auth.login('admin@crm-qa.invalid',qaPassword,{secondFactor:security.totp(enrollment.secret)});
   assert.equal((await auth.authenticate(logged.token))?.id,admin.user.id);await auth.logout(logged.token);
  });
  await check('Password-only MCP authorization rejects wrong passwords, unknown users, and non-Admins',async()=>{
   await assert.rejects(auth.verifyMcpAdminPassword('admin@crm-qa.invalid','wrong'),/INVALID_CREDENTIALS/);
   await assert.rejects(auth.verifyMcpAdminPassword('unknown@crm-qa.invalid',qaPassword),/INVALID_CREDENTIALS/);
   for(const email of ['sales@crm-qa.invalid','accountant@crm-qa.invalid','a@crm-qa.invalid'])await assert.rejects(auth.verifyMcpAdminPassword(email,qaPassword),/FORBIDDEN/);
  });
  await check('Inactive Admin identities cannot authorize MCP',async()=>{
   await db.query('UPDATE cohamy_crm.users SET active=false WHERE id=$1',[admin.user.id]);
   try{await assert.rejects(auth.verifyMcpAdminPassword('admin@crm-qa.invalid',qaPassword),/INVALID_CREDENTIALS/);}finally{await db.query('UPDATE cohamy_crm.users SET active=true WHERE id=$1',[admin.user.id]);}
  });
  await check('Password guessing uses the same persistent login rate limit',async()=>{
   const email='rate-limited@crm-qa.invalid';for(let i=0;i<8;i++)await assert.rejects(auth.verifyMcpAdminPassword(email,'wrong'),/INVALID_CREDENTIALS/);
   await assert.rejects(auth.verifyMcpAdminPassword(email,'wrong'),/LOGIN_RATE_LIMITED/);
  });
  await check('MCP password authentication is audited without credentials',async()=>{
   const events=await db.query<{payload:Record<string,unknown>}>("SELECT payload FROM cohamy_crm.audit_events WHERE action='mcp.password-verified' AND actor_id=$1",[admin.user.id]);
   assert.equal(events.rows.length,1);assert.deepEqual(events.rows[0].payload,{authentication:'password',browserSessionCreated:false});
   assert.equal(JSON.stringify(events.rows).includes(qaPassword),false);
  });
 }finally{
  await fs.mkdir('docs/crm/test-results/mcp-origin',{recursive:true});
  await fs.writeFile('docs/crm/test-results/mcp-origin/password-local.json',JSON.stringify({environment:'LOCAL isolated fictitious PGlite; no production account changes or emails',status:cases.length===6?'PASS':'FAIL',cases},null,2)+'\n');await db.close();
 }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'MCP_PASSWORD_QA_FAILED');process.exitCode=1;});

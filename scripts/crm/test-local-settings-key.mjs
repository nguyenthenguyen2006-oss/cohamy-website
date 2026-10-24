import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {localSettingsKey} from './local-settings-key.mjs';
const root=process.cwd(),saved=process.env.CRM_SETTINGS_ENCRYPTION_KEY;
const directory=path.resolve('.local/crm-qa-local-master-'+randomUUID()),checks=[];
try{
 delete process.env.CRM_SETTINGS_ENCRYPTION_KEY;
 await fs.mkdir(directory,{recursive:true});process.chdir(directory);
 const first=await localSettingsKey();assert.ok(Buffer.from(first,'base64').length===32,'Generated master must be 32 random bytes');
 checks.push({test:'Generate persistent random master in isolated local directory',status:'PASS'});
 const filename=path.resolve('.local/secure-settings/brevo-master.key');
 if(process.platform==='win32'){
  const env={...process.env,PSModulePath:path.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','Modules'),COHAMY_QA_KEY_FILE:filename};
  await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference='Stop'
$acl=[IO.File]::GetAccessControl($env:COHAMY_QA_KEY_FILE,[Security.AccessControl.AccessControlSections]::Access)
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-1-0'),'Read','Allow'))
[IO.File]::SetAccessControl($env:COHAMY_QA_KEY_FILE,$acl)`],{windowsHide:true,env});
  const second=await localSettingsKey();assert.ok(second===first,'Restart must keep the same key');
  const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$acl=[IO.File]::GetAccessControl($env:COHAMY_QA_KEY_FILE,[Security.AccessControl.AccessControlSections]::Access)
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$bad=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])|Where-Object {$_.IdentityReference.Value -ne $sid -and $_.IdentityReference.Value -ne 'S-1-5-18'})
@{protected=$acl.AreAccessRulesProtected;unexpectedRules=$bad.Count;rules=$acl.Access.Count}|ConvertTo-Json -Compress`],{windowsHide:true,env});
  const acl=JSON.parse(stdout);assert.equal(acl.protected,true);assert.equal(acl.unexpectedRules,0);assert.equal(acl.rules,2);
 }else{
  await fs.chmod(filename,0o644);const second=await localSettingsKey();assert.ok(first===second);assert.equal((await fs.stat(filename)).mode&0o777,0o600);
 }
 checks.push({test:'Existing/restored broad-read file is hardened before use without changing key',status:'PASS'});
 process.env.CRM_SETTINGS_ENCRYPTION_KEY='qa-explicit-server-master-'+randomUUID();assert.ok(await localSettingsKey()===process.env.CRM_SETTINGS_ENCRYPTION_KEY);
 checks.push({test:'Explicit server environment keeps precedence over local key file',status:'PASS'});
 await fs.writeFile(path.join(root,'docs/crm/test-results/document-flow/local-settings-key.json'),JSON.stringify({environment:process.platform,status:'PASS',checks,secretsIncluded:false},null,2));
 checks.forEach(c=>console.log('PASS',c.test));
}finally{
 process.chdir(root);if(saved===undefined)delete process.env.CRM_SETTINGS_ENCRYPTION_KEY;else process.env.CRM_SETTINGS_ENCRYPTION_KEY=saved;
}

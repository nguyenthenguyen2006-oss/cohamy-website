import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

// Local launcher only: the application and production workers never read this file.
export async function localSettingsKey(){
  if(process.env.CRM_SETTINGS_ENCRYPTION_KEY)return process.env.CRM_SETTINGS_ENCRYPTION_KEY;
  const directory=path.resolve('.local/secure-settings'),filename=path.join(directory,'brevo-master.key');
  await fs.mkdir(directory,{recursive:true,mode:0o700});
  const directoryInfo=await fs.lstat(directory);
  if(!directoryInfo.isDirectory()||directoryInfo.isSymbolicLink())throw Error('LOCAL_SETTINGS_KEY_DIRECTORY_INVALID');
  if(process.platform==='win32'){
    const script=`$ErrorActionPreference='Stop'
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
$acl=[System.IO.Directory]::GetAccessControl($env:COHAMY_LOCAL_SETTINGS_DIRECTORY,[System.Security.AccessControl.AccessControlSections]::Access)
$acl.SetAccessRuleProtection($true,$false)
foreach($rule in @($acl.Access)){$acl.RemoveAccessRuleAll($rule)}
$inherit=[System.Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl',$inherit,'None','Allow'))
$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new('S-1-5-18'),'FullControl',$inherit,'None','Allow'))
[System.IO.Directory]::SetAccessControl($env:COHAMY_LOCAL_SETTINGS_DIRECTORY,$acl)`;
    const modulePath=path.join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','Modules');
    try{await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,env:{...process.env,PSModulePath:modulePath,COHAMY_LOCAL_SETTINGS_DIRECTORY:directory}});}
    catch{throw Error('LOCAL_SETTINGS_KEY_PERMISSIONS_FAILED');}
  }else await fs.chmod(directory,0o700);
  try{
    const file=await fs.open(filename,'wx',0o600);
    try{await file.writeFile(randomBytes(32).toString('base64'));await file.sync();}finally{await file.close();}
  }catch(error){if(error.code!=='EEXIST')throw Error('LOCAL_SETTINGS_KEY_CREATE_FAILED');}
  const info=await fs.lstat(filename);
  if(!info.isFile()||info.isSymbolicLink())throw Error('LOCAL_SETTINGS_KEY_FILE_INVALID');
  if(process.platform==='win32'){
    const script=`$ErrorActionPreference='Stop'
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
$acl=[System.IO.File]::GetAccessControl($env:COHAMY_LOCAL_SETTINGS_FILE,[System.Security.AccessControl.AccessControlSections]::Access)
$acl.SetAccessRuleProtection($true,$false)
foreach($rule in @($acl.Access)){$acl.RemoveAccessRuleAll($rule)}
$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','Allow'))
$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new('S-1-5-18'),'FullControl','Allow'))
[System.IO.File]::SetAccessControl($env:COHAMY_LOCAL_SETTINGS_FILE,$acl)`;
    const modulePath=path.join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','Modules');
    try{await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,env:{...process.env,PSModulePath:modulePath,COHAMY_LOCAL_SETTINGS_FILE:filename}});}
    catch{throw Error('LOCAL_SETTINGS_KEY_PERMISSIONS_FAILED');}
  }else await fs.chmod(filename,0o600);
  const value=(await fs.readFile(filename,'utf8')).trim(),bytes=Buffer.from(value,'base64');
  if(bytes.length!==32||bytes.toString('base64')!==value)throw Error('LOCAL_SETTINGS_KEY_INVALID');
  return value;
}

import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
interface FileEntry{name:string;size:number;sha256:string}
async function digest(file:string){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function manifest(root:string){
 const entries:FileEntry[]=[];let total=0;
 async function scan(directory:string){
  for(const entry of (await fs.readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   const file=path.join(directory,entry.name),info=await fs.lstat(file);
   if(info.isSymbolicLink())throw new Error('PUBLIC_UPLOAD_SYMLINK_BLOCKED');
   if(info.isDirectory())await scan(file);
   else if(info.isFile()){
    total+=info.size;
    if(entries.length>=50000||total>Number(process.env.CRM_BACKUP_PUBLIC_FILE_LIMIT_BYTES??10737418240))throw new Error('PUBLIC_UPLOAD_BACKUP_QUOTA_EXCEEDED');
    entries.push({name:path.relative(root,file).split(path.sep).join('/'),size:info.size,sha256:await digest(file)});
   }else throw new Error('PUBLIC_UPLOAD_SPECIAL_FILE_BLOCKED');
  }
 }
 await scan(root);return entries.sort((a,b)=>a.name.localeCompare(b.name));
}
export async function backupPublicFiles(source:string,directory:string){
 const root=await fs.realpath(source),destination=await fs.realpath(directory),local=process.env.CRM_ENVIRONMENT==='LOCAL'&&root.startsWith(path.resolve('.local','crm-qa-site-files-'))&&destination.startsWith(path.resolve('.local','crm-qa-site-files-'));
 if(!local&&(!root.startsWith('/root/cohamy-shared/uploads/')||!destination.startsWith('/root/cohamy-backups/')))throw new Error('COHAMY_PUBLIC_BACKUP_PATH_REQUIRED');
 const before=await manifest(root),total=before.reduce((sum,f)=>sum+f.size,0),disk=await fs.statfs(destination);if(disk.bavail*disk.bsize<4*total+67108864)throw new Error('PUBLIC_UPLOAD_BACKUP_DISK_LIMIT');
 const copy=path.join(destination,'public-uploads'),restore=path.join(destination,'restored-public-uploads');await fs.mkdir(copy,{mode:0o700});
 for(const entry of before){const target=path.join(copy,entry.name);await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});await fs.copyFile(path.join(root,entry.name),target,fs.constants.COPYFILE_EXCL);await fs.chmod(target,0o600);}
 if(JSON.stringify(before)!==JSON.stringify(await manifest(copy))||JSON.stringify(before)!==JSON.stringify(await manifest(root)))throw new Error('PUBLIC_UPLOAD_CHANGED_DURING_BACKUP');
 await fs.cp(copy,restore,{recursive:true,errorOnExist:true,force:false});if(JSON.stringify(before)!==JSON.stringify(await manifest(restore)))throw new Error('PUBLIC_UPLOAD_RESTORE_MISMATCH');
 await fs.writeFile(path.join(destination,'public-files-manifest.json'),JSON.stringify(before,null,2),{mode:0o600});
 return {count:before.length,bytes:total,sha256:createHash('sha256').update(JSON.stringify(before)).digest('hex'),restored:true};
}

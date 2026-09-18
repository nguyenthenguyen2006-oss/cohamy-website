import fs from 'node:fs/promises';
import path from 'node:path';
export function expiredVerifiedBackups(records:{id:string;completedAt:string}[],days:number,minimum:number,now=Date.now()){
 if(!Number.isInteger(days)||days<1||days>3650||!Number.isInteger(minimum)||minimum<1||minimum>365)throw new Error('BACKUP_RETENTION_INVALID');
 const sorted=records.filter(r=>Number.isFinite(Date.parse(r.completedAt))).sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt));
 return sorted.slice(minimum).filter(r=>Date.parse(r.completedAt)<now-days*86400000).map(r=>r.id);
}
export async function pruneVerifiedBackups(root:string,sourceDatabase:string){
 const realRoot=await fs.realpath(root);if(!realRoot.startsWith('/root/cohamy-backups/'))throw new Error('COHAMY_BACKUP_ROOT_REQUIRED');
 const records:{id:string;completedAt:string}[]=[];
 for(const entry of await fs.readdir(realRoot,{withFileTypes:true})){
  if(!entry.isDirectory()||entry.isSymbolicLink()||!/^20\d{2}-\d{2}-\d{2}T\d{9}Z-[a-f0-9]{8}$/.test(entry.name))continue;
  const directory=path.join(realRoot,entry.name);if(await fs.realpath(directory)!==directory)continue;
  try{const report=JSON.parse(await fs.readFile(path.join(directory,'VERIFIED.json'),'utf8'));if(report.status==='PASS'&&report.directory===directory&&report.sourceDatabase===sourceDatabase&&/^[a-f0-9]{64}$/.test(report.sha256)&&!(await fs.stat(path.join(directory,'FAILED.json')).catch(()=>null)))records.push({id:entry.name,completedAt:report.completedAt});}catch{}
 }
 const selected=expiredVerifiedBackups(records,Number(process.env.CRM_BACKUP_RETENTION_DAYS??30),Number(process.env.CRM_BACKUP_MIN_COPIES??7));
 for(const id of selected){const directory=path.join(realRoot,id);if(!directory.startsWith(realRoot+'/')||await fs.realpath(directory)!==directory||(await fs.lstat(directory)).isSymbolicLink())throw new Error('BACKUP_RETENTION_PATH_CHANGED');await fs.rm(directory,{recursive:true});}
 return {removed:selected.length,retentionDays:Number(process.env.CRM_BACKUP_RETENTION_DAYS??30),minimumCopies:Number(process.env.CRM_BACKUP_MIN_COPIES??7)};
}

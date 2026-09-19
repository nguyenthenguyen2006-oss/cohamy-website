import 'server-only';
import {inflateRawSync} from 'node:zlib';
import {CrmError} from './permissions';
// Verify actual expanded bytes before ExcelJS sees the ZIP. Central sizes alone
// are attacker-controlled and are insufficient protection against a ZIP bomb.
export function validateCommercialXlsx(bytes:Buffer){
 if(bytes.length<22||bytes.length>2097152)throw new CrmError('FILE_SIZE_INVALID',413);
 let end=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(bytes.readUInt32LE(p)===0x06054b50){end=p;break;}
 if(end<0||bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6)||end+22+bytes.readUInt16LE(end+20)!==bytes.length)throw new CrmError('FILE_TYPE_INVALID',400);
 const count=bytes.readUInt16LE(end+10),start=bytes.readUInt32LE(end+16),directorySize=bytes.readUInt32LE(end+12);if(count<1||count>1000||start+directorySize!==end)throw new CrmError('FILE_SIZE_INVALID',413);
 let cursor=start,expanded=0;const names=new Set<string>();
 try{
  for(let i=0;i<count;i++){
   if(cursor+46>end||bytes.readUInt32LE(cursor)!==0x02014b50)throw new Error('ZIP_HEADER');
   const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),compressed=bytes.readUInt32LE(cursor+20),size=bytes.readUInt32LE(cursor+24),nameLength=bytes.readUInt16LE(cursor+28),extra=bytes.readUInt16LE(cursor+30),comment=bytes.readUInt16LE(cursor+32),offset=bytes.readUInt32LE(cursor+42);
   if(flags&1||![0,8].includes(method)||compressed===0xffffffff||size===0xffffffff||offset===0xffffffff||expanded+size>20971520||cursor+46+nameLength+extra+comment>end)throw new Error('ZIP_LIMIT');
   const name=bytes.subarray(cursor+46,cursor+46+nameLength).toString('utf8');if(!name||names.has(name)||name.includes('..')||name.includes('\\')||name.startsWith('/')||name.toLowerCase().includes('vbaproject')||name.includes('\0'))throw new Error('ZIP_NAME');names.add(name);
   if(offset+30>start||bytes.readUInt32LE(offset)!==0x04034b50||bytes.readUInt16LE(offset+8)!==method)throw new Error('ZIP_LOCAL');
   const localNameLength=bytes.readUInt16LE(offset+26),payload=offset+30+localNameLength+bytes.readUInt16LE(offset+28);if(payload+compressed>start||bytes.subarray(offset+30,offset+30+localNameLength).toString('utf8')!==name)throw new Error('ZIP_LOCAL');
   const content=bytes.subarray(payload,payload+compressed),data=method===0?content:inflateRawSync(content,{maxOutputLength:Math.max(1,Math.min(size+1,20971520))});if(data.length!==size)throw new Error('ZIP_SIZE');expanded+=data.length;cursor+=46+nameLength+extra+comment;
  }
  if(cursor!==end||!names.has('[Content_Types].xml')||!names.has('xl/workbook.xml'))throw new Error('XLSX_REQUIRED');
 }catch{throw new CrmError('FILE_TYPE_INVALID',400);}
 return {entries:count,expandedBytes:expanded};
}

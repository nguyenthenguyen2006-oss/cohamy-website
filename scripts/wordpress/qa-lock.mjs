import {existsSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
const file='.local/headless-qa.lock';
export function acquireQaLock(phase){
  if(existsSync(file)){
    const prior=JSON.parse(readFileSync(file,'utf8'));
    let alive=true;try{process.kill(prior.pid,0);}catch(error){if(error.code==='ESRCH')alive=false;}
    if(alive)throw Error(`Headless ${prior.phase} is running; finish it before ${phase}.`);
    unlinkSync(file);
  }
  const owner={pid:process.pid,phase,created:new Date().toISOString()};
  writeFileSync(file,JSON.stringify(owner),{flag:'wx'});
  return ()=>{if(existsSync(file)&&JSON.parse(readFileSync(file,'utf8')).pid===owner.pid)unlinkSync(file);};
}

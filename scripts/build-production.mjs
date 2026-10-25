import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Build workers need more memory than the web/worker runtime. Keep this override local to compilation.
const inherited=(process.env.NODE_OPTIONS??'').replace(/--max[-_]old[-_]space[-_]size(?:=|\s+)\d+/g,'').trim();
const env={...process.env,NODE_OPTIONS:[inherited,'--max-old-space-size=3072'].filter(Boolean).join(' ')};
const child=spawn(process.execPath,['--max-old-space-size=3072',fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url)),'build'],{stdio:'inherit',env});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
child.once('error',()=>{console.error('NEXT_BUILD_PROCESS_FAILED');process.exitCode=1;});
child.once('exit',code=>{process.exitCode=code??1;});

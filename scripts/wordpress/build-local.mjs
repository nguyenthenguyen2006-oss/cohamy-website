import {spawn} from 'node:child_process';
import {existsSync,mkdirSync} from 'node:fs';
import {acquireQaLock} from './qa-lock.mjs';
if(!existsSync('.local'))mkdirSync('.local');
const release=acquireQaLock('build');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',windowsHide:true,env:{...process.env,COHAMY_ISOLATED_LOCAL_BUILD:'true'}});
child.on('error',error=>{release();console.error(error.message);process.exitCode=1;});child.on('exit',code=>{release();process.exitCode=code ?? 1;});

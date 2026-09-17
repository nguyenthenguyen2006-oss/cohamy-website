import {readFileSync} from 'node:fs';
export function localBuildFile() {const runtime=JSON.parse(readFileSync('.local/runtime.json','utf8'));return (runtime.distDir || '.next')+'/BUILD_ID';}

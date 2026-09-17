import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const source=process.env.CRM_HUMANBANK_SOURCE || 'C:/Users/ACER/OneDrive/Desktop/EDUHMB/humanbank-edu';
const app=path.join(source,'apps/web/app');
const local=path.resolve('.local/crm-reference');await fs.mkdir(local,{recursive:true});
const sheetNames=['globals.css','foundation-design.css','public-design.css','public-utility-design.css','portal-design.css','dossier-design.css','legacy-crm.css','landing-teachers.css','landing-banners.css','finance-design.css','control-design.css'];
const fonts=path.resolve('node_modules/@fontsource/be-vietnam-pro');
const fontCss=(await Promise.all([400,500,600,700,800].map(weight=>fs.readFile(path.join(fonts,`${weight}.css`),'utf8')))).join('\n').replaceAll('./files/','/fonts/');
const css=fontCss+'\n'+(await Promise.all(sheetNames.map(name=>fs.readFile(path.join(app,name),'utf8')))).join('\n');
const fixture={id:'00000000-0000-4000-8000-000000000001',displayName:'LOCAL QA · Quản trị',roleCodes:['SUPER_ADMIN'],grants:[]};
const normalized=app.replaceAll('\\','/');
const entry=`import React from 'react'; import {createRoot} from 'react-dom/client';
import {PortalShell} from '${normalized}/components/portal-shell.tsx';
import Dashboard from '${normalized}/portal/dashboard/page.tsx';
import Login from '${normalized}/dang-nhap/page.tsx';
const user=${JSON.stringify(fixture)};
async function main(){const root=createRoot(document.getElementById('root'));if(location.pathname==='/login')root.render(<Login/>);else root.render(<PortalShell user={user}>{await Dashboard()}</PortalShell>);}
main();`;
await build({stdin:{contents:entry,loader:'tsx',resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',jsx:'automatic',outfile:path.join(local,'reference.js'),plugins:[{name:'reference-only-fixtures',setup(builder){
  builder.onResolve({filter:/^(react|react-dom)(\/.*)?$/},args=>({path:require.resolve(args.path)}));
  builder.onResolve({filter:/^@phosphor-icons\/react$/},()=>({path:require.resolve('@phosphor-icons/react')}));
  builder.onResolve({filter:/^next\/(link|image|navigation)$/},args=>({path:args.path,namespace:'fixture'}));
  builder.onResolve({filter:/(server-api|client-api|api-routes|app-path|demo-banner)$/},args=>({path:args.path,namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},args=>{
    const name=args.path;
    if(name==='next/link')return {contents:`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`,loader:'tsx'};
    if(name==='next/image')return {contents:`import React from 'react';export default function Image({priority,...props}){return <img {...props}/>}`,loader:'tsx'};
    if(name==='next/navigation')return {contents:`export const usePathname=()=>'/portal/dashboard';export const useRouter=()=>({replace:()=>{},refresh:()=>{},push:()=>{}});export const useSearchParams=()=>new URLSearchParams();`,loader:'js'};
    if(name.endsWith('server-api'))return {contents:`export const serverApi=async()=>({ok:true,data:${JSON.stringify(fixture)}});`,loader:'js'};
    if(name.endsWith('client-api'))return {contents:`export const clientApi=async()=>({ok:false,status:503,error:'REFERENCE ONLY, not a backend'});`,loader:'js'};
    if(name.endsWith('api-routes'))return {contents:`export const apiRoutes={me:'/reference/me',login:'/reference/login',logout:'/reference/logout'};`,loader:'js'};
    if(name.endsWith('app-path'))return {contents:`export const withAppBasePath=path=>path;`,loader:'js'};
    return {contents:'export const DemoBanner=()=>null;',loader:'js'};
  });
}}]});
const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LOCAL REFERENCE · HumanBank actual components, fixture auth only</title><link rel="stylesheet" href="/reference.css"></head><body><div id="root"></div><script type="module" src="/reference.js"></script></body></html>`;
const server=http.createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://127.0.0.1:4311');
  if(['/','/dashboard','/login'].includes(url.pathname)){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
  if(url.pathname==='/reference.css'){res.setHeader('Content-Type','text/css; charset=utf-8');res.end(css);return;}
  if(url.pathname==='/reference.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(await fs.readFile(path.join(local,'reference.js')));return;}
  if(url.pathname==='/brand/humanbank-logo.png'){res.setHeader('Content-Type','image/png');res.end(await fs.readFile(path.join(source,'apps/web/public/brand/humanbank-logo.png')));return;}
  if(/^\/fonts\/[a-z0-9-]+\.woff2$/u.test(url.pathname)){res.setHeader('Content-Type','font/woff2');res.end(await fs.readFile(path.join(fonts,'files',path.basename(url.pathname))));return;}
  res.writeHead(404);res.end();
 }catch{res.writeHead(500);res.end('LOCAL REFERENCE FAILED');}
});
server.listen(4311,'127.0.0.1',()=>console.log('LOCAL REFERENCE http://127.0.0.1:4311 (actual HumanBank components/CSS; fictitious auth; no production access)'));

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createHash} from 'node:crypto';
const readSource=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n').replace(/^\uFEFF/,'');

// Static allowlist generated from the actual authenticated CRM routes. Never accept a URL from a tool.
const root='app/api/crm', out='lib/crm/mcp/routes.generated.ts';
const excluded={auth:'Browser login/logout',security:'Public account recovery and MFA enrollment stay in the browser',carrier:'Carrier signature webhook', 'brevo-webhook':'Provider webhook, not an admin operation',portal:'Dealer identity only',mcp:'OAuth protocol endpoints are not business tools; connection management is explicitly allowlisted'};
const removed=new Set([...readSource('lib/crm/module-availability.ts').matchAll(/^\s+"([^"]+)",/gm)].map(m=>m[1]));
function evaluate(n,selection){if(!n)return undefined;if(ts.isStringLiteral(n))return n.text;if(ts.isIdentifier(n))return n.text==='action'?selection:undefined;if(ts.isArrayLiteralExpression(n))return n.elements.map(e=>evaluate(e,selection));if(ts.isConditionalExpression(n))return evaluate(n.condition,selection)?evaluate(n.whenTrue,selection):evaluate(n.whenFalse,selection);if(ts.isBinaryExpression(n)){const a=evaluate(n.left,selection),b=evaluate(n.right,selection);switch(n.operatorToken.getText()){case '===':return a===b;case '!==':return a!==b;case '||':return a||b;case '&&':return a&&b;}}if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)){const target=evaluate(n.expression.expression,selection),arg=evaluate(n.arguments[0],selection);if(n.expression.name.text==='includes'&&Array.isArray(target))return target.includes(arg);if(n.expression.name.text==='startsWith'&&typeof target==='string'&&typeof arg==='string')return target.startsWith(arg);}return undefined;}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.name==='route.ts'?[path.join(dir,e.name).replaceAll('\\','/')]:[]);}
function parse(file){return ts.createSourceFile(file,readSource(file),ts.ScriptTarget.Latest,true);}
function visit(node,fn){fn(node);ts.forEachChild(node,n=>visit(n,fn));}
function values(node,key){const found=new Set();const condition=n=>{
 if(ts.isBinaryExpression(n)&&['===','!==','==','!='].includes(n.operatorToken.getText())){
   if(n.left.getText()===key&&ts.isStringLiteral(n.right))found.add(n.right.text);
   if(n.right.getText()===key&&ts.isStringLiteral(n.left))found.add(n.left.text);
 }
 if(ts.isCallExpression(n)&&n.expression.getText().endsWith('.includes')&&n.arguments[0]?.getText()===key){const arr=n.expression.expression;if(ts.isArrayLiteralExpression(arr))for(const e of arr.elements)if(ts.isStringLiteral(e))found.add(e.text);}
};visit(node,n=>{if(ts.isIfStatement(n))visit(n.expression,condition);if(ts.isSwitchStatement(n)&&n.expression.getText()===key)for(const c of n.caseBlock.clauses)if(ts.isCaseClause(c)&&ts.isStringLiteral(c.expression))found.add(c.expression.text);});return [...found].sort();}
function contracts(file){const s=parse(file),parts=[];visit(s,n=>{if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&/schema$/i.test(n.name.text)&&n.initializer)parts.push('const '+n.name.text+' = '+n.initializer.getText());else if(ts.isCallExpression(n)&&(n.expression.getText()==='z.object'||ts.isPropertyAccessExpression(n.expression)&&['extend','pick','omit','partial','required','merge'].includes(n.expression.name.text)))parts.push(n.getText());});return [...new Set(parts)].join('\n').slice(0,26000);}
const routes=[],imports=[],dispatch=[],skipped=[];
const managementSource='app/api/crm/mcp/oauth/[action]/route.ts';
imports.push(`import * as mcpManagement from '@/app/api/crm/mcp/oauth/[action]/route';`);dispatch.push(`${JSON.stringify(managementSource)}: mcpManagement`);
for(const [method,action]of [['GET','connections'],['POST','disconnect']])routes.push({id:method+' /api/crm/mcp/oauth/'+action,method,template:'/api/crm/mcp/oauth/'+action,source:managementSource,group:'mcp',status:'AVAILABLE',moduleId:null,params:[],selector:{action},query:[],inputContract:method==='GET'?'':'z.object({id:z.uuid()}).strict() // connection id from GET connections',multipart:false,sourceHash:createHash('sha256').update(readSource(managementSource)+readSource('lib/crm/mcp/oauth.ts')).digest('hex')});
for(const file of walk(root).sort()){
 const relative=file.slice(root.length+1,-'/route.ts'.length),group=relative.split('/')[0];
 if(excluded[group]){skipped.push({route:'/api/crm/'+relative,reason:excluded[group]});continue;}
 const source=parse(file),text=source.text,alias='r'+imports.length;
 if(!text.includes('apiUser('))throw Error('MCP_UNREVIEWED_AUTH:'+file);
 imports.push(`import * as ${alias} from '@/`+file.slice(0,-3)+`';`);
 dispatch.push(`${JSON.stringify(file)}: ${alias}`);
 const serviceFiles=[...text.matchAll(/from\s+['"](@\/lib\/crm\/[^'"]+)['"]/g)].map(m=>m[1].replace('@/','')+'.ts').filter(f=>fs.existsSync(f));
 const contract=[contracts(file),...serviceFiles.map(contracts)].filter(Boolean).join('\n').slice(0,48000);
 for(const node of source.statements){
  if(!ts.isFunctionDeclaration(node)||!node.name||!['GET','POST','PATCH','PUT','DELETE'].includes(node.name.text))continue;
  const method=node.name.text,keys=[...relative.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1]);
  const selector=keys.find(k=>['action','resource'].includes(k));let selections=selector?values(node,selector):[''];
  if(selector&&!selections.length&&relative==='accountant/[action]'&&method==='POST')selections=values(parse('lib/crm/accountant-workflow.ts'),'action');
  if(selector&&!selections.length)throw Error('MCP_UNREVIEWED_DISPATCH:'+file+':'+method);
  const query=[...new Set([...node.getText().matchAll(/\.get\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]))].sort();
  for(const selection of selections){
    const template='/api/crm/'+(selector?relative.replace('['+selector+']',selection):relative);
    const id=method+' '+template;
    let moduleId;visit(node,n=>{if(ts.isCallExpression(n)&&n.expression.getText()==='apiUser')moduleId=evaluate(n.arguments[0],selection);});
    routes.push({id,method,template,source:file,group:group.startsWith('[')?'directory':group,status:typeof moduleId==='string'&&removed.has(moduleId)?'RETIRED':'AVAILABLE',moduleId:moduleId??null,params:keys.filter(k=>k!==selector),selector:selector?{[selector]:selection}:{},query,inputContract:method==='GET'?'':contract,multipart:['POST /api/crm/documents','POST /api/crm/internal-documents','POST /api/crm/jobs/preview','POST /api/crm/commerce/excel-preview','POST /api/crm/consignment/sale-preview'].includes(id),sourceHash:createHash('sha256').update(text+serviceFiles.map(readSource).join('\n')).digest('hex')});
  }
 }
}
const sharedContracts={},metadata=routes.map(route=>{const key=route.inputContract?createHash('sha256').update(route.inputContract).digest('hex').slice(0,16):'';if(key)sharedContracts[key]=route.inputContract;return {...route,inputContract:key};});
const generated=`// Generated by scripts/crm/generate-mcp-catalog.mjs. Do not edit.\n${imports.join('\n')}\nexport interface McpRoute {id:string;method:'GET'|'POST'|'PATCH'|'PUT'|'DELETE';template:string;source:string;group:string;status:'AVAILABLE'|'RETIRED';moduleId:string|null;params:string[];selector:Record<string,string>;query:string[];inputContract:string;multipart:boolean;sourceHash:string}\nconst sharedContracts: Record<string,string> = ${JSON.stringify(sharedContracts,null,2)};\nconst metadata: McpRoute[] = ${JSON.stringify(metadata,null,2)};\nexport const mcpRoutes: McpRoute[] = metadata.map(route=>({...route,inputContract:sharedContracts[route.inputContract]??''}));\nexport const mcpExcludedRoutes: {route:string;reason:string}[] = ${JSON.stringify(skipped,null,2)};\nexport const mcpHandlers: Record<string, unknown> = {${dispatch.join(',\n')}};\n`;
if(process.argv.includes('--check')){if(!fs.existsSync(out)||readSource(out)!==generated){console.error('MCP catalog is stale. Run npm run crm:mcp:catalog, review changed capabilities, and rerun tests.');process.exit(1);}}else{fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,generated);}
console.log(JSON.stringify({operations:routes.length,available:routes.filter(r=>r.status==='AVAILABLE').length,retired:routes.filter(r=>r.status==='RETIRED').length,read:routes.filter(r=>r.method==='GET').length,write:routes.filter(r=>r.method!=='GET').length,excludedRoutes:skipped.length}));

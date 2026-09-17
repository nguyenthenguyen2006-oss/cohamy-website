import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import postcss from 'postcss';

// Read-only import from HumanBank. Emits patch data; never writes to the source repo.
const source = process.env.CRM_HUMANBANK_SOURCE || 'C:/Users/ACER/OneDrive/Desktop/EDUHMB/humanbank-edu';
const app = path.join(source, 'apps/web/app');
const sheets = ['globals.css','foundation-design.css','public-design.css','public-utility-design.css','portal-design.css','dossier-design.css','legacy-crm.css','landing-teachers.css','landing-banners.css','finance-design.css','control-design.css'];
const tokens = ['portal-shell','portal-topbar','portal-masthead-brand','portal-brand-logo','portal-system-title','portal-topbar__actions','portal-user-menu','portal-user-summary','portal-user-avatar','portal-workspace','portal-content','portal-bottom-navigation','crm-dashboard','crm-module-grid','crm-module-tile','particle-network','crm-login','crm-login-input-wrap','auth-form','auth-field-heading','password-wrap','password-toggle','field','field-error','field-help','button','icon-button','form-status','portal-page-header','table-toolbar','table-shell','data-table','table-primary','table-footer','pagination','legacy-total-line','legacy-list-heading','detail-card','form-card','form-section','create-disclosure','resource-facts','state-panel','text-link','skip-link','sr-only'];
const tokenSet = new Set(tokens);
function simplify(selector) {
  return selector.replace(/:(is|where)\(([^()]+)\)/gu,(whole,name,inside)=>{
    const options=inside.split(',').filter(part=>![...part.matchAll(/\.([\w-]+)/gu)].some(match=>!tokenSet.has(match[1])&&!tokens.some(token=>match[1].startsWith(token+'--')||match[1].startsWith(token+'__'))));
    return options.length?`:${name}(${options.join(',')})`:whole;
  });
}
function matches(selector) {
  if(/^\[data-tone=/u.test(selector))return true;
  const classes=[...selector.matchAll(/\.([\w-]+)/gu)].map(match=>match[1]);
  const allowed=name=>tokenSet.has(name) || tokens.some(token=>name.startsWith(token+'--')||name.startsWith(token+'__')) || ['is-active','is-selected','is-invalid'].includes(name);
  return classes.length>0 && classes.every(allowed) && classes.some(name=>tokenSet.has(name)||tokens.some(token=>name.startsWith(token+'--')||name.startsWith(token+'__')));
}
const baseline = `.cohamy-crm { --hb-accent:#f97316; --hb-control-radius:4px; color-scheme:light; font-family:"Be Vietnam Pro","Segoe UI",sans-serif; font-size:15px; line-height:1.6; min-height:100dvh; color:#111827; background:#fff; }
.cohamy-crm *, .cohamy-crm *::before, .cohamy-crm *::after { box-sizing:border-box; }
.cohamy-crm :where(h1,h2,h3,h4,p,figure,form) { margin:0; }
.cohamy-crm :where(button,input,select,textarea) { font:inherit; }
.cohamy-crm :where(h1,h2,h3,h4) { font-family:"Be Vietnam Pro",system-ui,sans-serif; text-wrap:balance; }
.cohamy-crm a { color:inherit; text-decoration:none; }
.cohamy-crm :focus-visible { outline:2px solid #f97316; outline-offset:3px; }
.cohamy-crm ::selection { background:#fed7aa; color:#111827; }
.cohamy-crm .sr-only { position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap; }
.cohamy-crm .skip-link { position:fixed; z-index:200; top:10px; left:10px; transform:translateY(-200%); padding:10px; background:#fff; color:#111827; }
.cohamy-crm .skip-link:focus { transform:none; }
`;
const output = [baseline];
const manifest = [];
for (const sheet of sheets) {
  const raw = fs.readFileSync(path.join(app,sheet),'utf8');
  const ast = postcss.parse(raw);
  const selected = postcss.root();
  function select(container,destination) {
    for(const node of container.nodes || []) {
      if(node.type==='rule') {
        const selectors = node.selectors.map(simplify).filter(matches);
        if(!selectors.length)continue;
        const clone=node.clone();
        clone.selector=selectors.map(selector => {
          let scoped=selector.replace(/:root/gu,'.cohamy-crm').replace(/\bbody(?=:has|\s|$)/gu,'.cohamy-crm');
          if(!scoped.startsWith('.cohamy-crm'))scoped='.cohamy-crm '+scoped;
          return scoped;
        }).join(',\n');
        clone.walkDecls(decl => { decl.value=decl.value.replace(/(-?[\d.]+)rem\b/gu,(_match,value)=>`${Number(value)*16}px`); });
        destination.append(clone);
      } else if(node.type==='atrule' && ['media','supports','layer'].includes(node.name)) {
        const clone=node.clone({nodes:[]});select(node,clone);if(clone.nodes.length)destination.append(clone);
      } else if(node.type==='atrule' && node.name==='keyframes' && node.params.startsWith('legacy-crm'))destination.append(node.clone());
    }
  }
  select(ast,selected);
  if(selected.nodes.length)output.push(`/* HumanBank ${sheet}; original cascade order. */\n${selected.toString()}`);
  manifest.push({file:`apps/web/app/${sheet}`,sha256:crypto.createHash('sha256').update(raw).digest('hex'),selectedRules:selected.nodes.length});
}
const extras = `
/* Cohamy additions: status disclosure, scoped layout safety and real-data forms. */
.cohamy-crm .crm-release-note { max-width:760px;margin:32px auto 0;text-align:center;color:#cbd5e1;font-size:12px; }
.cohamy-crm .crm-record-form { display:grid;gap:20px;padding:24px;max-width:900px;margin:12px; }
.cohamy-crm .crm-form-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px; }
.cohamy-crm .crm-form-actions { display:flex;gap:12px;align-items:center;flex-wrap:wrap; }
.cohamy-crm .crm-status-note { padding:16px;margin:12px;border:1px solid #d9dee6;background:#f8fafc;color:#475569;font-size:13px; }
.cohamy-crm .crm-failure { padding:40px 20px;display:grid;gap:20px;max-width:760px;margin:auto; }
.cohamy-crm .crm-table-wrap { max-width:100%;min-width:0;overflow:auto;margin:12px;border:1px solid #d9dee6;scrollbar-color:#94a3b8 #f1f5f9; }
.cohamy-crm .crm-table-wrap .data-table { width:100%;min-width:640px;border-collapse:collapse;font-size:13px; }
.cohamy-crm .crm-table-wrap .data-table th,.cohamy-crm .crm-table-wrap .data-table td { padding:12px;text-align:left;border-bottom:1px solid #d9dee6;vertical-align:top; }
.cohamy-crm .crm-table-wrap .data-table th { color:#475569;background:#f1f5f9; }
.cohamy-crm .crm-table-wrap .table-primary { display:grid;gap:3px;color:#075fba; }
.cohamy-crm .crm-table-wrap .table-primary span { color:#5b6472;font-size:12px; }
.cohamy-crm .crm-readonly { display:grid;gap:12px;margin:12px;padding:24px;border:1px solid #d9dee6;background:#fff; }
.cohamy-crm .crm-readonly dt { font-weight:600;font-size:12px;color:#5b6472; }
.cohamy-crm .crm-readonly dd { margin:0;overflow-wrap:anywhere; }
.cohamy-crm .crm-login__box .field input::placeholder { color:#a4afc0; }
.cohamy-crm .crm-login__footer { color:#94a3b8; }
.cohamy-crm .crm-login-page { min-height:100dvh;background:#020617;color:#fff; }
.cohamy-crm .portal-brand-logo { max-width:160px; }
.cohamy-crm .button:disabled { cursor:wait;opacity:.55; }
.cohamy-crm .portal-content { min-width:0; }
@media(max-width:540px) { .cohamy-crm .crm-form-grid {grid-template-columns:minmax(0,1fr);} .cohamy-crm .crm-record-form {padding:16px;margin:8px;} .cohamy-crm .crm-release-note {padding:0 8px;} }
@media(prefers-reduced-motion:reduce) { .cohamy-crm *, .cohamy-crm *::before, .cohamy-crm *::after { animation:none !important;transition:none !important;scroll-behavior:auto !important; } }
@media(prefers-reduced-motion:reduce) { .cohamy-crm :is(.button,.icon-button,.portal-user-menu > summary,.portal-user-menu__content > a,.portal-user-menu__content > button,.portal-bottom-navigation__inner > a,.portal-bottom-navigation__inner > button,.crm-module-tile) {transition-duration:0s !important;transition-property:none !important;} }
`;
const components = ['components/portal-shell.tsx','portal/layout.tsx','portal/dashboard/page.tsx','components/particle-network.tsx','components/portal-module-icon.tsx','lib/portal-modules.ts','lib/portal-navigation.ts','dang-nhap/page.tsx','components/login-form.tsx','layout.tsx','portal/crm/customers/page.tsx','portal/crm/customers/new/page.tsx','components/resource-table.tsx','portal/finance/settlements/page.tsx'];
for(const file of components)manifest.push({file:`apps/web/app/${file}`,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(app,file))).digest('hex')});
const files=[{path:'components/crm/crm.css',content:output.join('\n\n')+extras},{path:'docs/crm/source-manifest.json',content:JSON.stringify({capturedAt:new Date().toISOString(),source,readOnly:true,remBase:16,finalControlFinish:'control-design.css overrides radius to 4px and gradients to flat colors',files:manifest},null,2)+'\n'}];
const serialized=JSON.stringify({files});
if(process.argv[2]==='--summary')process.stdout.write(JSON.stringify({characters:serialized.length,chunks:Math.ceil(serialized.length/16000),files:files.map(file=>({path:file.path,characters:file.content.length}))}));
else if(process.argv[2]==='--chunk')process.stdout.write(serialized.slice(Number(process.argv[3])*16000,(Number(process.argv[3])+1)*16000));
else process.stdout.write(serialized);

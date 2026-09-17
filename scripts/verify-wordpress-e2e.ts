import {localBuildFile} from './wordpress/local-build.mjs';
import {acquireQaLock} from './wordpress/qa-lock.mjs';
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import Papa from "papaparse";
import sharp from "sharp";
import { BLOG_HEADERS, type BlogRow } from "@/lib/blog-schema";

type Credential = { username: string; password: string; application_password: string; id: number };
const checks = [
  "01 warm draft cache", "02 publish in WordPress", "03 public HTTP 200 and content", "04 one self-referencing canonical",
  "05 indexable robots", "06 crawlable listing anchor", "07 sitemap and UTC lastModified", "08 update content SEO and media",
  "09 unpublish removes public and sitemap", "10 non-public statuses remain secret", "11 scheduled publish without WP HTTP traffic",
  "12 same slug translations and uniqueness", "13 CSV template import and safe reimport", "14 webhook signature timestamp replay",
  "15 permissions and authenticated real Next preview", "16 actual WordPress 503 does not become empty sitemap or 404", "17 same Next process and build",
  "18 slug 301 and loop prevention", "19 CMS protection and old admin write lock", "20 Gutenberg content and sanitization",
];
const results = checks.map((name) => ({ name, status: "NOT RUN", detail: "" }));
const config = JSON.parse(readFileSync(".local/secrets.json", "utf8"));
const credentials: Record<string, Credential> = JSON.parse(readFileSync(".local/credentials.json", "utf8"));
const cms = `http://127.0.0.1:${config.cms_port}`;
const front = `http://127.0.0.1:${config.frontend_port}`;
const runId = `e2e-${Date.now().toString(36)}`;
const publicPath = `/vi/bai-viet/${runId}`;
let postId: number; let draftId: number;
async function http(url: string, options?: RequestInit) {
  const response = await fetch(url, { redirect: "manual", ...options, signal: AbortSignal.timeout(90000) });
  return { response, text: await response.text() };
}
async function wp(endpoint: string, data?: unknown, role: string | null = "admin", method = data ? "POST" : "GET") {
  const credential = role ? credentials[role] : undefined;
  const { response, text } = await http(cms + "/wp-json" + endpoint, {
    method, headers: { ...(credential ? { Authorization: `Basic ${Buffer.from(`${credential.username}:${credential.application_password}`).toString("base64")}` } : {}), ...(data ? { "Content-Type": "application/json" } : {}) }, body: data ? JSON.stringify(data) : undefined,
  });
  let body; try { body = JSON.parse(text); } catch { throw new Error(`WordPress invalid JSON, status ${response.status}: ${text.slice(0,200)}`); }
  return { status: response.status, body };
}
async function save(endpoint: string, data: unknown, role = "admin") {
  const result = await wp(endpoint, data, role); assert(result.status < 300, JSON.stringify(result.body)); return result.body;
}
async function snapshot() { const result = await wp("/cohamy/v1/snapshot?q="+encodeURIComponent(runId), undefined, null); assert.equal(result.status,200); return result.body as { revision: string; posts: BlogRow[] }; }
async function html(route: string, status = 200) { const result = await http(front + route); assert.equal(result.response.status, status, `${route}: ${result.text.slice(0,150)}`); return result; }
async function sitemap() { const index=(await html("/sitemap.xml")).text;if(!index.includes('<sitemapindex'))return index;let xml=index;for(const loc of index.matchAll(/<loc>(.*?)<\/loc>/g))xml+=(await html(new URL(loc[1]).pathname)).text;return xml; }
async function check(index: number, action: () => Promise<string | void>) {
  if(process.argv.includes('--only-schedule') && index!==11 && index!==17)return;
  const result = results[index-1];
  try { const detail = await action(); result.status = "PASS"; result.detail = detail || "Verified with real local WordPress and running Next.js"; console.log(`PASS ${result.name}${detail ? ": "+detail : ""}`); }
  catch (error) { result.status = "FAIL"; result.detail = error instanceof Error ? error.message : String(error); console.error(`FAIL ${result.name}: ${result.detail}`); throw error; }
}
function payload(slug: string, status = "draft", locale = "vi", group = slug) {
  return { title: "Kiểm thử Cohamy " + slug, excerpt: "Mô tả tiếng Việt của bài kiểm thử", content: `<!-- wp:heading --><h2 class="wp-block-heading">Nội dung Cohamy</h2><!-- /wp:heading --><!-- wp:paragraph --><p>LOCAL_CONTENT_${slug}</p><!-- /wp:paragraph -->`, status,
    meta: { _cohamy_locale: locale, _cohamy_public_slug: slug, _cohamy_group_id: group, _cohamy_legacy_id: `${slug}-${locale}`, _cohamy_author: "Cohamy QA", _cohamy_featured: "TRUE", _cohamy_related_product_ids: "cohamy-almond-chocolate", rank_math_title: "SEO thật Cohamy " + slug, rank_math_description: "Mô tả Rank Math thật " + slug, rank_math_robots: ["index","follow"] } };
}
const readyCount = (text: string) => (text.match(/Ready in/g) || []).length;
const nextLogBefore = readFileSync(".local/logs/next.log", "utf8");
const runtimeBefore = JSON.parse(readFileSync(".local/runtime.json", "utf8"));
let buildIdBefore = "development";
try { buildIdBefore = readFileSync(localBuildFile(), "utf8"); } catch { /* Development server has no build ID. */ }
async function main() {
  await check(1, async () => {
    const post = await save("/wp/v2/posts", payload(runId)); postId=post.id; draftId=post.id;
    await html(publicPath,404); await html("/vi/bai-viet"); await html("/en"); assert(!(await sitemap()).includes(publicPath));
    assert(!(await snapshot()).posts.some((post) => post.slug===runId));
    return `Draft ${postId}; warmed detail/list/home/sitemap before publish`;
  });
  await check(2, async () => { const result = await save(`/wp/v2/posts/${postId}`,{ status:"publish" }); assert.equal(result.status,"publish"); });
  await check(3, async () => { const { text } = await html(publicPath); assert(text.includes(`LOCAL_CONTENT_${runId}`)); });
  await check(4, async () => {
    const { text } = await html(publicPath); const canonicals = text.match(/<link\b[^>]*rel="canonical"[^>]*>/g) || [];
    assert.equal(canonicals.length,1); assert(canonicals[0].includes(`href="https://cohamy.vn${publicPath}"`)); assert(!canonicals[0].includes(cms));
    assert(text.includes(`property="og:url" content="https://cohamy.vn${publicPath}"`));
    const schemas=[...text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match)=>JSON.parse(match[1]));
    const articles=schemas.filter((schema)=>schema['@type']==='Article');const breadcrumbs=schemas.filter((schema)=>schema['@type']==='BreadcrumbList');
    assert.equal(articles.length,1); assert.equal(breadcrumbs.length,1);
    assert.equal(articles[0].mainEntityOfPage['@id'],`https://cohamy.vn${publicPath}`);
    assert.equal(breadcrumbs[0].itemListElement[2].item,`https://cohamy.vn${publicPath}`);
  });
  await check(5, async () => { const { text, response } = await html(publicPath); assert(!/noindex/i.test(response.headers.get("x-robots-tag") || "")); assert(!/<meta\b[^>]*name="(?:robots|googlebot)"[^>]*content="[^"]*noindex/i.test(text)); });
  await check(6, async () => { const { text } = await html("/vi/bai-viet"); assert(text.includes(`href="${publicPath}"`)); assert(new RegExp(`<a[^>]+href="${publicPath}"`).test(text)); });
  await check(7, async () => { const post=(await snapshot()).posts.find((post)=>post.slug===runId)!; const xml=await sitemap(); const block=xml.split("<url>").find((block)=>block.includes(`https://cohamy.vn${publicPath}</loc>`)); assert(block); assert(block.includes(`<lastmod>${post.updated_at}</lastmod>`)); assert(post.updated_at.endsWith("Z")); return `lastModified=${post.updated_at}`; });
  await check(8, async () => {
    const image = await sharp({ create: { width: 800, height: 450, channels: 3, background: "#a36632" } }).png().toBuffer();
    const credential=credentials.admin;
    const media=await http(cms+"/wp-json/wp/v2/media",{ method:"POST", headers:{ Authorization:`Basic ${Buffer.from(`${credential.username}:${credential.application_password}`).toString("base64")}`,"Content-Type":"image/png","Content-Disposition":`attachment; filename="${runId}.png"` }, body:new Uint8Array(image) });
    assert.equal(media.response.status,201); const attachment=JSON.parse(media.text);
    await save(`/wp/v2/media/${attachment.id}`,{alt_text:"Ảnh kiểm thử mới Cohamy"});
    await save(`/wp/v2/posts/${postId}`,{ title:"Tiêu đề đã sửa Cohamy",excerpt:"Description cập nhật Rank Math",content:`<h2>Nội dung mới</h2><p>UPDATED_CONTENT_${runId}</p>`,featured_media:attachment.id,meta:{rank_math_title:"%title% %sep% %sitename%",rank_math_description:"%excerpt%"} });
    const {text}=await html(publicPath); assert(text.includes(`UPDATED_CONTENT_${runId}`)); assert(text.includes(attachment.source_url)); assert(text.includes("Ảnh kiểm thử mới Cohamy"));
    assert(/<title>Tiêu đề đã sửa Cohamy[^<]*Cohamy<\/title>/.test(text),text.match(/<title>[^<]*<\/title>/)?.[0]); assert(text.includes('name="description" content="Description cập nhật Rank Math"')); assert(!/<title>[^<]*%title%/.test(text));
    return "Native Rank Math %title%/%sep%/%sitename%/%excerpt% resolved; new WP upload visible";
  });
  await check(9, async () => { await save(`/wp/v2/posts/${postId}`,{status:"draft"}); await html(publicPath,404); assert(!(await sitemap()).includes(publicPath)); assert(!(await html("/vi/bai-viet")).text.includes(`href="${publicPath}"`)); });
  await check(10, async () => {
    for (const status of ["draft","pending","private","future","trash"]) {
      const slug=`${runId}-${status}`; const data=payload(slug,status==="trash" ? "draft" : status);
      if(status==="future") Object.assign(data,{date_gmt:new Date(Date.now()+3600000).toISOString().replace(/\.\d+Z$/,""),date:new Date(Date.now()+8*3600000).toISOString().replace(/\.\d+Z$/,"")});
      const post=await save("/wp/v2/posts",data);
      if(status==="trash") assert.equal((await wp(`/wp/v2/posts/${post.id}`,undefined,"admin","DELETE")).status,200);
      await html(`/vi/bai-viet/${slug}`,404);
      const publicResult=await wp(`/wp/v2/posts/${post.id}`,undefined,null); assert(publicResult.status>=400);
      assert(!(await snapshot()).posts.some((row)=>row.slug===slug)); assert(!(await sitemap()).includes(slug));
    }
  });
  if (!process.argv.includes("--skip-schedule")) await check(11, async () => {
    const slug=`${runId}-scheduled`; const when=Date.now()+90000;
    const post=await save("/wp/v2/posts",{...payload(slug,"future"),date_gmt:new Date(when).toISOString().replace(/\.\d+Z$/,""),date:new Date(when+7*3600000).toISOString().replace(/\.\d+Z$/,"")});
    assert.equal(post.status,"future"); await html(`/vi/bai-viet/${slug}`,404);
    if(process.argv.includes('--lose-schedule-event'))await new Promise<void>((resolve,reject)=>{
      const child=spawn(process.env.PHP_BINARY || 'php',['-c','.local/php.ini','scripts/wordpress/drop-local-schedule.php',String(post.id)],{windowsHide:true,stdio:'inherit'});
      child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Lost-event fixture failed.')));
    });
    const cmsLog=runtimeBefore.cms_replacement_watchdog?".local/logs/wordpress-recovery.log":".local/logs/wordpress.log";
    const accessBefore=await readFile(cmsLog,"utf8");
    console.log(`WAIT scheduled ${post.id}: no WordPress HTTP reads for 94 seconds; independent PHP CLI cron remains running`);
    await new Promise((resolve)=>setTimeout(resolve,94000));
    const accessAfter=await readFile(cmsLog,"utf8");
    assert(!accessAfter.slice(accessBefore.length).includes("Accepted"),"WordPress received HTTP traffic during the cron wait. Close CMS browser tabs/health polling before this test.");
    const cronLog=await readFile(".local/logs/cron.log","utf8"); assert(cronLog.includes(`publish_future_post ${post.id}`));
    const result=await wp(`/wp/v2/posts/${post.id}`); assert.equal(result.body.status,"publish");
    assert((await html(`/vi/bai-viet/${slug}`)).text.includes(`LOCAL_CONTENT_${slug}`)); assert((await sitemap()).includes(`/vi/bai-viet/${slug}`));
    return `CLI cron published ${post.id} at UTC schedule; no WP page traffic during wait${process.argv.includes('--lose-schedule-event') ? '; CONTROLLED missing native event repaired before publication' : ''}`;
  });
  await check(12, async () => {
    const group=`${runId}-translations`; const slug=`${runId}-shared`;
    for (const locale of ["vi","en","zh","ko","ja"]) {
      await save("/wp/v2/posts",payload(slug,"publish",locale,group)); await html(`/${locale}/${locale==="vi" ? "bai-viet" : "blog"}/${slug}`);
    }
    const duplicate=await wp("/wp/v2/posts",{...payload(slug,"draft","vi",`${group}-other`),meta:{...payload(slug,"draft","vi",`${group}-other`).meta,_cohamy_legacy_id:randomUUID()}}); assert.equal(duplicate.status,409);
    const duplicateGroup=await wp("/wp/v2/posts",payload(slug+"-other","draft","en",group)); assert.equal(duplicateGroup.status,409);
    const vi=await html(`/vi/bai-viet/${slug}`); assert(/hreflang="ja"/i.test(vi.text)); assert(vi.text.includes('href="https://cohamy.vn/ja/blog/'+slug+'"'));
    const noindex=(await wp("/wp/v2/posts?context=edit&per_page=100")).body.find((post: {meta:Record<string,string>})=>post.meta._cohamy_group_id===group && post.meta._cohamy_locale==="ja");
    await save(`/wp/v2/posts/${noindex.id}`,{meta:{rank_math_robots:["noindex","follow"]}});
    assert(!/hreflang="ja"/i.test((await html(`/vi/bai-viet/${slug}`)).text)); assert(!(await sitemap()).includes(`/ja/blog/${slug}</loc>`));
    return "5 real translations share a public slug; duplicates rejected; noindex translation excluded from hreflang/sitemap";
  });
  await check(13, async () => {
    const loginPage=await http(cms+"/wp-login.php"); const initial=loginPage.response.headers.getSetCookie().map((cookie)=>cookie.split(";")[0]).join("; ");
    const login=await http(cms+"/wp-login.php",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Cookie:initial},body:new URLSearchParams({log:credentials.admin.username,pwd:credentials.admin.password,"wp-submit":"Log In",redirect_to:cms+"/wp-admin/",testcookie:"1"}).toString()});
    assert.equal(login.response.status,302); const cookie=login.response.headers.getSetCookie().map((item)=>item.split(";")[0]).join("; ");
    const adminPage=await http(cms+"/wp-admin/edit.php?page=cohamy-import",{headers:{Cookie:cookie}}); assert.equal(adminPage.response.status,200);
    const download=adminPage.text.match(/href="([^"]*admin-post\.php\?action=cohamy_csv_template[^"]*)"/); assert(download);
    const downloaded=await fetch(download[1].replace(/&(?:amp|#0*38|#x0*26);/gi,"&"),{headers:{Cookie:cookie},redirect:"manual"});assert.equal(downloaded.status,200);
    const bytes=Buffer.from(await downloaded.arrayBuffer());assert(bytes.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf])),"Excel template must include a UTF-8 BOM");
    const template={text:bytes.toString("utf8")};assert(template.text.startsWith("\uFEFFsep=;\r\n"));
    const header=Papa.parse<string[]>(template.text.replace(/^\uFEFF/,"").split(/\r?\n/).slice(1).join("\r\n"),{delimiter:";"}).data[0]; assert.deepEqual(header,[...BLOG_HEADERS]);
    const now=new Date().toISOString();
    const row={id:`${runId}-csv`,group_id:`${runId}-csv-group`,locale:"vi",slug:`${runId}-csv`,title:'CSV tiếng Việt "dấu nháy", dấu ;',excerpt:"Nhiều dòng\nMô tả",content_html:'<h2>CSV thật</h2>\n<p>Tiếng Việt; "nháy", xuống dòng\nđúng HTML</p>',cover_image:"",cover_image_alt:"",author:"Cohamy QA",category:"chocolate",tags:"socola,hạt",featured:"FALSE",related_product_ids:"cohamy-almond-chocolate",seo_title:"CSV SEO thật",seo_description:"CSV description thật",canonical_url:"https://old.example.test/retained",robots_index:"TRUE",status:"published",scheduled_at:"",published_at:now,created_at:now,updated_at:now};
    async function importCSV(delimiter:string,rows: Record<string,string>[],mode:string,preserveStatus=false,role="admin") {
      const csv="\uFEFF"+(delimiter===";" ? "sep=;\r\n" : "")+Papa.unparse(rows,{columns:[...BLOG_HEADERS],delimiter,newline:"\r\n"});
      const form=new FormData(); form.set("file",new Blob([csv]),"test.csv"); form.set("mode",mode); if(preserveStatus) form.set("preserve_status","true");
      const cred=credentials[role]; const previewResult=await http(cms+"/wp-json/cohamy/v1/import/preview",{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${cred.username}:${cred.application_password}`).toString("base64")}`},body:form});
      assert.equal(previewResult.response.status,200); const preview=JSON.parse(previewResult.text); let cursor=0;let batch;
      do {batch=await save("/cohamy/v1/import/batch",{token:preview.token,cursor},role);cursor=batch.cursor;} while(!batch.done);
      return {preview,batch};
    }
    const first=await importCSV(";",[row,{...row,id:row.id+"-bad",group_id:row.group_id+"-bad",slug:"Invalid Slug"}],"create"); assert.equal(first.preview.invalid,1);assert.equal(first.batch.created,1);assert.equal(first.batch.failed,1);
    const after=(await wp("/cohamy/v1/export")).body.rows.filter((post:BlogRow)=>post.id===row.id); assert.equal(after.length,1);assert.equal(after[0].status,"draft");assert.equal(after[0].title,row.title);assert(after[0].content_html.includes('Tiếng Việt; "nháy", xuống dòng\nđúng HTML'));
    const again=await importCSV(",",[{...row,title:"CSV cập nhật"}],"upsert");assert.equal(again.batch.created,0);assert.equal(again.batch.updated,1);assert.equal((await wp("/cohamy/v1/export")).body.rows.filter((post:BlogRow)=>post.id===row.id).length,1);
    const restricted=await importCSV(";",[{...row,id:row.id+"-writer",group_id:row.group_id+"-writer",slug:row.slug+"-writer"}],"create",true,"writer");assert.equal(restricted.preview.valid,0);assert.equal(restricted.batch.created,0);
    const batchRows=Array.from({length:27},(_,index)=>({...row,id:`${runId}-batch-${index}`,group_id:`${runId}-batch-${index}`,slug:`${runId}-batch-${index}`}));
    const large=await importCSV(";",batchRows,"create");assert.equal(large.batch.cursor,27);assert.equal(large.batch.created,27);
    return "Downloaded Excel CSV; ; and , with quotes/HTML/newlines; draft default; row errors; 27 records in multiple batches; rerun updated one ID";
  });
  await check(14, async () => {
    const body=JSON.stringify({event_id:randomUUID(),revision:randomUUID(),post_ids:[postId],paths:[publicPath]}); const stamp=String(Math.floor(Date.now()/1000));
    const sign=(timestamp:string)=>createHmac("sha256",config.webhook_secret).update(`${timestamp}.${body}`).digest("hex");
    const send=async(timestamp:string,signature:string)=>(await http(front+"/api/wordpress/webhook",{method:"POST",headers:{"Content-Type":"application/json","X-Cohamy-Timestamp":timestamp,"X-Cohamy-Signature":signature},body})).response.status;
    assert.equal(await send(stamp,"0".repeat(64)),401);const expired=String(Number(stamp)-600);assert.equal(await send(expired,sign(expired)),401);assert.equal(await send(stamp,sign(stamp)),200);assert.equal(await send(stamp,sign(stamp)),409);
  });
  await check(15, async () => {
    const own=await save("/wp/v2/posts",payload(`${runId}-writer`),"writer");assert.equal(own.status,"draft");
    const pending=await save(`/wp/v2/posts/${own.id}`,{status:"pending"},"writer");assert.equal(pending.status,"pending");
    const publish=await wp(`/wp/v2/posts/${own.id}`,{status:"publish"},"writer");assert.equal(publish.status,403);
    assert((await wp("/cohamy/v1/preview-token",{id:draftId},"writer")).status>=400);
    assert((await wp("/cohamy/v1/preview-token",{id:draftId},null)).status>=400);
    assert.equal((await wp("/cohamy/v1/preview",{token:"bad"},null)).status,403);
    const grant=await save("/cohamy/v1/preview-token",{id:draftId}); const url=new URL(grant.url);
    const begin=await http(front+url.pathname+url.search);assert.equal(begin.response.status,303);
    assert.equal(new URL(begin.response.headers.get("location")!,front).origin,new URL(front).origin,"Preview redirect must keep the cookie on the incoming browser origin.");
    assert(begin.response.headers.getSetCookie().some((value)=>/HttpOnly/i.test(value)&&/Path=\/preview/i.test(value)&&/SameSite=Lax/i.test(value)));
    const cookie=begin.response.headers.getSetCookie().map((item)=>item.split(";")[0]).join("; ");assert(cookie.includes("cohamy_wp_preview="));
    const preview=await http(front+"/preview/blog",{headers:{Cookie:cookie}});assert.equal(preview.response.status,200);assert(preview.text.includes(`UPDATED_CONTENT_${runId}`));assert(preview.response.headers.get("x-robots-tag")?.includes("noindex"));assert(preview.response.headers.get("cache-control")?.includes("no-store"));assert(/name="robots" content="noindex, nofollow"/.test(preview.text));
    assert.equal((await http(front+"/preview/blog")).response.status,404);
    const review=await save(`/wp/v2/posts/${own.id}`,{status:"publish"},"reviewer");assert.equal(review.status,"publish");
    return "Writer sends pending, cannot publish/preview another user's draft; reviewer publishes; signed draft renders the actual Next article";
  });
  await check(16, async () => {
    const maintenance=path.resolve(".local/wordpress/.maintenance");
    await writeFile(maintenance,`<?php $upgrading = ${Math.floor(Date.now()/1000)};` ,{flag:"wx"});
    try {
      const unavailable=await http(cms+"/wp-json/cohamy/v1/revision");assert.equal(unavailable.response.status,503);
      const detail=await http(front+`/vi/bai-viet/${runId}-shared`);assert.equal(detail.response.status,503);
      const xml=await http(front+"/sitemap.xml");assert(xml.response.status>=500);assert(!xml.text.includes("<urlset"));
      const list=await http(front+"/vi/bai-viet");assert(list.response.status>=500);
      const health=await http(front+"/api/health");assert.equal(health.response.status,503);
    } finally {await unlink(maintenance);}
    assert((await sitemap()).includes(`${runId}-shared`));
    return "Real WP maintenance HTTP 503; detail 503, sitemap/list fail explicitly, no empty sitemap/false 404; recovery without Next restart";
  });
  await check(18, async () => {
    await save(`/wp/v2/posts/${postId}`,{status:"publish"}); const changed=`${runId}-renamed`;
    await save(`/wp/v2/posts/${postId}`,{meta:{_cohamy_public_slug:changed}});
    const old=await http(front+publicPath);assert.equal(old.response.status,301);assert(old.response.headers.get("location")?.endsWith(`/vi/bai-viet/${changed}`));assert.equal(new URL(old.response.headers.get("location")!,front).origin,new URL(front).origin);assert(old.response.headers.get("cache-control")?.includes("no-store"));await html(`/vi/bai-viet/${changed}`);
    assert(!(await sitemap()).includes(publicPath+"</loc>"));
    await save(`/wp/v2/posts/${postId}`,{meta:{_cohamy_public_slug:runId}});await html(publicPath);
    const reverse=await http(front+`/vi/bai-viet/${changed}`);assert.equal(reverse.response.status,301);assert(reverse.response.headers.get("location")?.endsWith(publicPath));
    return "Old slug 301 → current slug; reverting slug removes redirect loop";
  });
  await check(19, async () => {
    const old=await http(front+"/api/admin/posts",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});assert.equal(old.response.status,410);
    const admin=await http(front+"/admin");assert.equal(admin.response.status,307);assert(admin.response.headers.get("location")?.includes("/wp-admin"));
    assert.equal((await http(cms+"/sitemap_index.xml")).response.status,404);assert.equal((await http(cms+"/wp-sitemap.xml")).response.status,404);
    const cmsResponse=await http(cms+"/");assert(cmsResponse.response.headers.get("x-robots-tag")?.includes("noindex"));
    const robots=await http(front+"/robots.txt");assert(robots.text.includes("Sitemap: https://cohamy.vn/sitemap.xml"));assert(!robots.text.includes("Disallow: /vi/bai-viet"));
  });
  await check(20, async () => {
    const content=`<!-- wp:paragraph --><p>GUTENBERG_SAFE_${runId} <a href="${cms}/?p=${postId}">Liên kết bài</a></p><!-- /wp:paragraph --><!-- wp:list --><ul class="wp-block-list"><!-- wp:list-item --><li>Một</li><!-- /wp:list-item --></ul><!-- /wp:list --><!-- wp:quote --><blockquote class="wp-block-quote"><p>Trích dẫn</p></blockquote><!-- /wp:quote --><!-- wp:table --><figure class="wp-block-table"><table><tbody><tr><td>Bảng thật</td></tr></tbody></table><figcaption>Chú thích bảng</figcaption></figure><!-- /wp:table --><script>UNSAFE_MARKER()</script><a href="javascript:alert(1)">XSS</a>`;
    await save(`/wp/v2/posts/${postId}`,{content});const {text}=await html(publicPath);assert(text.includes(`GUTENBERG_SAFE_${runId}`));assert(text.includes("<table>"));assert(text.includes("<figcaption>Chú thích bảng</figcaption>"));assert(text.includes('href="https://cohamy.vn'+publicPath+'"'));assert(!text.includes("UNSAFE_MARKER"));assert(!text.includes('href="javascript:'));
    const unsupported=await wp(`/wp/v2/posts/${postId}`,{content:'<!-- wp:embed {"url":"https://example.com"} --><figure>Embed</figure><!-- /wp:embed -->'});assert.equal(unsupported.status,400);assert.equal(unsupported.body.code,"unsupported_blocks");
  });
  await check(17, async () => {
    const after=await readFile(".local/logs/next.log","utf8");assert.equal(readyCount(after),readyCount(nextLogBefore));
    const runtimeAfter=JSON.parse(await readFile(".local/runtime.json","utf8"));assert.deepEqual(runtimeAfter,runtimeBefore);
    assert.equal(runtimeBefore.mode,"production","Run final E2E with headless:local -- --production to verify actual production cache.");
    process.kill(runtimeBefore.frontend,0);
    assert.equal(await readFile(localBuildFile(),"utf8"),buildIdBefore);
    return `Same Next production PID ${runtimeBefore.frontend}; no restart/build/deploy during all mutations; build ${buildIdBefore}`;
  });
}
async function run() {
const release=acquireQaLock('blog E2E mutations');
try {await main();}
catch {process.exitCode=1;}
finally {
  await mkdir("docs/headless/test-results",{recursive:true});
  const scheduleOnly=process.argv.includes('--only-schedule');const selected=scheduleOnly?results.filter((_,i)=>i===10 || i===16):results;
  const report={environment:"LOCAL / REAL WORDPRESS + REAL RANK MATH",database:"SQLite 3 via official WordPress SQLite Database Integration",runtime:runtimeBefore,runId,cms,front,startedBuild:buildIdBefore,finishedAt:new Date().toISOString(),results:selected};
  const file=`docs/headless/test-results/${scheduleOnly?'schedule-latest':'e2e-latest'}.json`;await writeFile(file,JSON.stringify(report,null,2)+"\n");
  console.log(`${selected.filter((result)=>result.status==="PASS").length}/${selected.length} PASS. Report: ${file}`);
  release();
}
}
run().catch((error)=>{ console.error(error); process.exitCode=1; });

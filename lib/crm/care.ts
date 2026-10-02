import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {database,type Sql} from './db';
import {audit,assertCurrentPrincipal} from './auth';
import {assertPermission,CrmError} from './permissions';
import {getOrganization,assertWritableOrganization} from './repository';
import {getOrder} from './work';
import {parse} from './workspace';
import type {Principal} from './types';
import {getAllPublicPosts} from '@/lib/blog-repository';
import {buildBlogPostPath} from '@/lib/blog-seo';
function editor(user:Principal){assertPermission(user,'partners.write');if(user.area!=='crm')throw new CrmError('FORBIDDEN',403);}
export async function contacts(user:Principal,id:string){await getOrganization(user,id);return(await(await database()).query<{id:string;name:string;responsibility:string;phone:string;email:string;is_primary:boolean;active:boolean;version:number}>('SELECT * FROM cohamy_crm.partner_contacts WHERE organization_id=$1 ORDER BY active DESC,is_primary DESC,name',[id])).rows;}
export async function saveContact(user:Principal,input:unknown){editor(user);const d=parse(z.object({id:z.uuid().optional(),organizationId:z.uuid(),name:z.string().trim().min(2).max(120),responsibility:z.enum(['Chủ đơn vị','Người mua','Kế toán','Người nhận','Khác']),phone:z.string().trim().max(40),email:z.union([z.literal(''),z.email()]),isPrimary:z.boolean(),active:z.boolean(),version:z.number().int().min(0)}).strict(),input);return(await database()).transaction(async tx=>{await assertCurrentPrincipal(tx,user);await assertWritableOrganization(tx,user,d.organizationId);await tx.query('SELECT id FROM cohamy_crm.organizations WHERE id=$1 FOR UPDATE',[d.organizationId]);if(d.isPrimary&&!d.active)throw new CrmError('INVALID_FIELDS',400);if(d.isPrimary)await tx.query('UPDATE cohamy_crm.partner_contacts SET is_primary=false,version=version+1 WHERE organization_id=$1 AND is_primary AND id<>$2',[d.organizationId,d.id??randomUUID()]);const id=d.id??randomUUID();const r=d.version===0?await tx.query('INSERT INTO cohamy_crm.partner_contacts(id,organization_id,name,responsibility,phone,email,is_primary,active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[id,d.organizationId,d.name,d.responsibility,d.phone,d.email,d.isPrimary,d.active]):await tx.query('UPDATE cohamy_crm.partner_contacts SET name=$1,responsibility=$2,phone=$3,email=$4,is_primary=$5,active=$6,version=version+1 WHERE id=$7 AND organization_id=$8 AND version=$9 RETURNING id',[d.name,d.responsibility,d.phone,d.email,d.isPrimary,d.active,id,d.organizationId,d.version]);if(!r.rows.length)throw new CrmError('VERSION_CONFLICT',409);await audit(tx,user.id,'contact.saved',d.organizationId,{contactId:id,active:d.active});return {id};});}
export interface CareTask{id:string;entity_type:'partner'|'order';entity_id:string;assignee_id:string;version:number;done_at:string|null;title:string}
export async function taskAccess(user:Principal,id:string,sql?:Sql,editing=true){editor(user);const tx=sql??await database();const t=(await tx.query<CareTask>('SELECT * FROM cohamy_crm.tasks WHERE id=$1',[id])).rows[0];if(!t)throw new CrmError('NOT_FOUND',404);if(t.entity_type==='partner')await getOrganization(user,t.entity_id,tx);else await getOrder(user,t.entity_id,tx);if(editing&&t.assignee_id!==user.membershipId&&!['ADMIN','MANAGER'].includes(user.role))throw new CrmError('FORBIDDEN',403);return t;}
export async function checklist(user:Principal,id:string){await taskAccess(user,id,undefined,false);return(await(await database()).query<{id:string;title:string;position:number;done:boolean;version:number}>('SELECT * FROM cohamy_crm.task_checklist WHERE task_id=$1 ORDER BY position,id',[id])).rows;}
export async function saveChecklist(user:Principal,input:unknown){const d=parse(z.object({taskId:z.uuid(),items:z.array(z.object({title:z.string().trim().min(1).max(200),done:z.boolean()})).max(50),version:z.number().int().positive()}).strict(),input);return(await database()).transaction(async tx=>{await tx.exec('LOCK TABLE cohamy_crm.task_dependencies IN SHARE ROW EXCLUSIVE MODE');await assertCurrentPrincipal(tx,user);await tx.query('SELECT id FROM cohamy_crm.tasks WHERE id=$1 FOR UPDATE',[d.taskId]);const t=await taskAccess(user,d.taskId,tx);if(t.version!==d.version)throw new CrmError('VERSION_CONFLICT',409);if(t.done_at&&d.items.some(x=>!x.done))throw new CrmError('TASK_ALREADY_DONE',409);await tx.query('DELETE FROM cohamy_crm.task_checklist WHERE task_id=$1',[d.taskId]);for(const [position,item]of d.items.entries())await tx.query('INSERT INTO cohamy_crm.task_checklist(id,task_id,title,position,done) VALUES ($1,$2,$3,$4,$5)',[randomUUID(),d.taskId,item.title,position,item.done]);await tx.query('UPDATE cohamy_crm.tasks SET version=version+1 WHERE id=$1',[d.taskId]);await audit(tx,user.id,'task.checklist-updated',t.entity_id,{taskId:t.id});return {version:t.version+1};});}
export async function dependencies(user:Principal,id:string){await taskAccess(user,id,undefined,false);const rows=(await(await database()).query<{id:string;title:string;done_at:string|null}>('SELECT p.id,p.title,p.done_at FROM cohamy_crm.task_dependencies d JOIN cohamy_crm.tasks p ON p.id=d.prerequisite_id WHERE d.task_id=$1',[id])).rows;const result=[];for(const row of rows){try{await taskAccess(user,row.id,undefined,false);result.push(row);}catch(e){if(!(e instanceof CrmError)||![403,404].includes(e.status))throw e;}}return result;}
export async function saveDependency(user:Principal,input:unknown){const d=parse(z.object({taskId:z.uuid(),prerequisiteId:z.uuid(),remove:z.boolean().default(false)}).strict(),input);return(await database()).transaction(async tx=>{await tx.exec('LOCK TABLE cohamy_crm.task_dependencies IN EXCLUSIVE MODE');await assertCurrentPrincipal(tx,user);const t=await taskAccess(user,d.taskId,tx),p=await taskAccess(user,d.prerequisiteId,tx);if(t.done_at)throw new CrmError('TASK_ALREADY_DONE',409);if(t.entity_type!==p.entity_type||t.entity_id!==p.entity_id)throw new CrmError('DEPENDENCY_SCOPE_MISMATCH',400);if(d.remove)await tx.query('DELETE FROM cohamy_crm.task_dependencies WHERE task_id=$1 AND prerequisite_id=$2',[d.taskId,d.prerequisiteId]);else{const cycle=(await tx.query(`WITH RECURSIVE ancestors(id) AS (SELECT prerequisite_id FROM cohamy_crm.task_dependencies WHERE task_id=$1 UNION SELECT d.prerequisite_id FROM cohamy_crm.task_dependencies d JOIN ancestors a ON a.id=d.task_id) SELECT id FROM ancestors WHERE id=$2`,[d.prerequisiteId,d.taskId])).rows.length;if(d.taskId===d.prerequisiteId||cycle)throw new CrmError('DEPENDENCY_CYCLE',409);await tx.query('INSERT INTO cohamy_crm.task_dependencies(task_id,prerequisite_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',[d.taskId,d.prerequisiteId]);}await audit(tx,user.id,'task.dependency-updated',t.entity_id,{taskId:t.id});return {saved:true};});}

export async function getSuggestedArticlesForCustomer(
  user: Principal,
  customerId: string
): Promise<{
  articles: Array<{
    id: string;
    slug: string;
    title: string;
    publicUrl: string;
    category: string;
    publishedAt: string;
    status: 'published';
    matchedProducts: string[];
  }>;
  totalSuggested: number;
}> {
  await getOrganization(user, customerId);
  const db = await database();

  const productRows = (await db.query<{ product_id: string; sku: string }>(
    `SELECT DISTINCT p.id as product_id, p.sku
     FROM cohamy_crm.products p
     WHERE EXISTS (
       SELECT 1 FROM cohamy_crm.commercial_request_versions crv
       JOIN cohamy_crm.commercial_requests cr ON cr.id = crv.request_id
       WHERE cr.organization_id = $1
         AND (crv.snapshot::text ILIKE '%' || p.sku || '%' OR crv.snapshot::text ILIKE '%' || p.id::text || '%')
     ) OR EXISTS (
       SELECT 1 FROM cohamy_crm.sales_order_versions sov
       JOIN cohamy_crm.sales_orders so ON so.id = sov.order_id
       WHERE so.organization_id = $1
         AND (sov.snapshot::text ILIKE '%' || p.sku || '%' OR sov.snapshot::text ILIKE '%' || p.id::text || '%')
     )`,
    [customerId]
  )).rows;

  const identifiers = new Set<string>();
  for (const p of productRows) {
    identifiers.add(p.product_id.toLowerCase());
    identifiers.add(p.sku.toLowerCase());
  }

  const publishedArticles = await getAllPublicPosts();

  const matchedArticles: Array<{
    id: string;
    slug: string;
    title: string;
    publicUrl: string;
    category: string;
    publishedAt: string;
    status: 'published';
    matchedProducts: string[];
  }> = [];

  for (const post of publishedArticles) {
    const matches: string[] = [];
    for (const rel of post.related_product_ids || []) {
      if (identifiers.has(rel.toLowerCase())) {
        matches.push(rel);
      }
    }
    if (matches.length > 0) {
      const publicUrl = buildBlogPostPath(post);
      matchedArticles.push({
        id: post.id,
        slug: post.slug,
        title: post.title,
        publicUrl,
        category: post.category,
        publishedAt: post.published_at,
        status: 'published',
        matchedProducts: matches,
      });
    }
  }

  return {
    articles: matchedArticles,
    totalSuggested: matchedArticles.length,
  };
}

export async function recordArticleLinkCopied(
  user: Principal,
  input: { customerId: string; articleId: string; articleSlug: string; notes?: string }
): Promise<{ activityId: string; status: 'COPIED' }> {
  editor(user);
  const db = await database();
  return db.transaction(async tx => {
    await assertCurrentPrincipal(tx, user);
    await assertWritableOrganization(tx, user, input.customerId);
    const post=(await getAllPublicPosts()).find(row=>row.id===input.articleId&&row.slug===input.articleSlug);
    if(!post)throw new CrmError('PUBLIC_ARTICLE_NOT_FOUND',404);

    const activityId = randomUUID();
    const body = `[LIÊN KẾT BÀI VIẾT ĐÃ SAO CHÉP] Đã sao chép liên kết ${buildBlogPostPath(post)} để chuẩn bị chia sẻ. Khách chưa xác nhận đã nhận hoặc đã đọc. Ghi chú: ${input.notes ?? ''}`;

    await tx.query(
      `INSERT INTO cohamy_crm.activities(id, entity_type, entity_id, actor_id, body)
       VALUES ($1, 'partner', $2, $3, $4)`,
      [activityId, input.customerId, user.id, body]
    );

    await audit(tx, user.id, 'care.article-link-copied', input.customerId, {
      articleId: input.articleId,
      articleSlug: input.articleSlug,
      status: 'COPIED',
    });

    return { activityId, status: 'COPIED' };
  });
}

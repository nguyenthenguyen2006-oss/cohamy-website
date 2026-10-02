import 'server-only';
import { randomUUID } from 'node:crypto';
import { database, type Sql } from './crm/db';
import { CrmError } from './crm/permissions';
import { legacyBlogRows } from './blog-legacy';
import type { BlogRow } from './blog-schema';

export async function legacyRowsWithCrmArticles(publicOnly = false): Promise<BlogRow[]> {
  const rows = new Map(legacyBlogRows().map(row => [row.id, row]));
  // Static builds without a CRM connection still have the bundled legacy articles.
  if (!process.env.CRM_DATABASE_URL && process.env.CRM_DATABASE_MODE !== 'pglite') return [...rows.values()];
  const saved = (await (await database()).query<{id: string; draft_row: BlogRow; public_row: BlogRow | null}>(
    'SELECT id,draft_row,public_row FROM cohamy_crm.website_articles',
  )).rows;
  for (const article of saved) {
    rows.delete(article.id);
    const row = publicOnly ? article.public_row : article.draft_row;
    if (row) rows.set(article.id, row);
  }
  return [...rows.values()];
}

export async function storeCrmArticle(sql: Sql, row: BlogRow, actorId: string, action: string, expectedUpdatedAt?: string) {
  // Serialize slug and translation-group validation, including newly imported legacy rows.
  await sql.exec('LOCK TABLE cohamy_crm.website_articles IN SHARE ROW EXCLUSIVE MODE');
  const existing = (await sql.query<{draft_row: BlogRow; public_row: BlogRow | null; version: number}>(
    'SELECT draft_row,public_row,version FROM cohamy_crm.website_articles WHERE id=$1 FOR UPDATE', [row.id],
  )).rows[0];
  const baseline = existing?.draft_row ?? legacyBlogRows().find(item => item.id === row.id);
  if (expectedUpdatedAt && baseline?.updated_at !== expectedUpdatedAt) throw new CrmError('VERSION_CONFLICT', 409);
  const peers = [...legacyBlogRows(), ...(await sql.query<{draft_row: BlogRow}>('SELECT draft_row FROM cohamy_crm.website_articles')).rows.map(item => item.draft_row)];
  if (peers.some(item => item.id !== row.id && item.locale === row.locale && (item.slug === row.slug || item.group_id === row.group_id))) throw new CrmError('ARTICLE_SLUG_OR_TRANSLATION_EXISTS', 409);
  row.created_at = baseline?.created_at ?? row.created_at;
  const publicRow = ['published','scheduled'].includes(row.status) ? row
    : ['unpublished','archived'].includes(action) ? null
    : existing?.public_row ?? (baseline?.status === 'published' ? baseline : null);
  const version = (existing?.version ?? 0) + 1;
  await sql.query(`INSERT INTO cohamy_crm.website_articles(id,locale,slug,draft_row,public_row,version)
    VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6) ON CONFLICT(id) DO UPDATE SET locale=excluded.locale,
    slug=excluded.slug,draft_row=excluded.draft_row,public_row=excluded.public_row,version=excluded.version,updated_at=now()`,
  [row.id,row.locale,row.slug,JSON.stringify(row),publicRow ? JSON.stringify(publicRow) : null,version]);
  await sql.query('INSERT INTO cohamy_crm.website_article_revisions(id,article_id,number,row_snapshot,action,actor_id) VALUES($1,$2,$3,$4::jsonb,$5,$6)',
    [randomUUID(),row.id,version,JSON.stringify(row),action,actorId]);
  return row;
}

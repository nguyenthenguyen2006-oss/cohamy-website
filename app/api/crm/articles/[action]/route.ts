import { apiError, apiUser, json, readJson, sameOrigin } from '@/lib/crm/http';
import { CrmError } from '@/lib/crm/permissions';
import * as a from '@/lib/crm/articles';
import {z} from 'zod';
import {BLOG_LOCALES,BLOG_CATEGORIES,BLOG_STATUSES} from '@/lib/blog-schema';
import {parseCommercial} from '@/lib/crm/commercial-common';

type Context = { params: Promise<{ action: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const user = await apiUser();
    const { action } = await context.params;
    const q = new URL(request.url).searchParams;

    if (action === 'list') {
      const page = Number(q.get('page')) || 1;
      const pageSize = Number(q.get('pageSize')) || 20;
      const search = q.get('q') ?? '';
      const locale = q.get('locale') ? parseCommercial(z.enum(BLOG_LOCALES),q.get('locale')) : undefined;
      const category = q.get('category') ? parseCommercial(z.enum(BLOG_CATEGORIES),q.get('category')) : undefined;
      const status = q.get('status') ? parseCommercial(z.enum(BLOG_STATUSES),q.get('status')) : undefined;

      return json(await a.listCrmArticles(user, { page, pageSize, q: search, locale, category, status }));
    }

    if (action === 'get') {
      const id = q.get('id') ?? '';
      return json(await a.getCrmArticle(user, id));
    }

    throw new CrmError('NOT_FOUND', 404);
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const user = await apiUser();
    const { action } = await context.params;
    const input = await readJson(request, action==='save'?524288:32768);

    if (action === 'save') return json(await a.saveCrmArticle(user, input));
    if (['publish','unpublish','archive'].includes(action)) {
      const data=parseCommercial(z.object({id:z.string().trim().min(1),expectedUpdatedAt:z.string().optional(),reason:z.string().optional(),idempotencyKey:z.uuid().optional()}).strict(),input);
      if(action==='publish')return json(await a.publishCrmArticle(user,data));
      if(action==='unpublish')return json(await a.unpublishCrmArticle(user,data));
      return json(await a.archiveCrmArticle(user,data.id));
    }

    throw new CrmError('NOT_FOUND', 404);
  } catch (e) {
    return apiError(e);
  }
}

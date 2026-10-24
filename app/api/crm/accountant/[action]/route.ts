import {apiError, apiUser, json, readJson, sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import {
  getAccountantWorkspaceData,
  handleAccountantWorkflowAction,
} from '@/lib/crm/accountant-workflow';

type Context = {params: Promise<{action: string}>};

export async function GET(request: Request, context: Context) {
  try {
    const user = await apiUser();
    if (['ACCOUNTANT','FACTORY','WAREHOUSE','WAREHOUSE_HN','WAREHOUSE_HCM'].includes(user.role)) throw new CrmError('LEGACY_WORKSPACE_DISABLED',403);
    const {action} = await context.params;
    const p = new URL(request.url).searchParams;
    if (action === 'workspace') {
      return json(await getAccountantWorkspaceData(user));
    }
    if (action === 'order-clearance') {
      const requestId = p.get('requestId') ?? '';
      const orderId = p.get('orderId') ?? '';
      const data = await getAccountantWorkspaceData(user);
      const found =
        data.orderClearances.find(
          c =>
            (requestId && c.requestId === requestId) ||
            (orderId && c.orderId === orderId)
        ) ?? null;
      return json({clearance: found, warehouses: data.warehouses});
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
    const {action} = await context.params;
    const input = await readJson(request);
    return json(
      await handleAccountantWorkflowAction(
        user,
        action,
        (input ?? {}) as Record<string, unknown>
      )
    );
  } catch (e) {
    return apiError(e);
  }
}

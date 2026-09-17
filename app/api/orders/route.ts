import {apiError,json,readJson,sameOrigin} from "@/lib/crm/http";
import {createWebsiteOrder} from "@/lib/crm/website-orders";
import {database} from "@/lib/crm/db";
import {CrmError} from "@/lib/crm/permissions";
export async function POST(request:Request) {
  try {
    sameOrigin(request);
    if(process.env.CRM_WEBSITE_ORDER_INTAKE!=="true")throw new CrmError("ORDER_INTAKE_NOT_ENABLED",503);
    // Conservative global limit until a trusted reverse proxy/client identity is configured.
    const attempts=await (await database()).query<{attempts:number}>(`INSERT INTO cohamy_crm.login_attempts(key_hash,attempts) VALUES ('website-order-intake',1)
      ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN cohamy_crm.login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE cohamy_crm.login_attempts.attempts+1 END,
      window_start=CASE WHEN cohamy_crm.login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE cohamy_crm.login_attempts.window_start END RETURNING attempts`);
    if(attempts.rows[0].attempts>60)throw new CrmError("ORDER_RATE_LIMITED",429);
    return json(await createWebsiteOrder(await readJson(request)),201);
  }catch(error){return apiError(error);}
}

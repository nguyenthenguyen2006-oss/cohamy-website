import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import * as p from '@/lib/crm/pricing';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{const user=await apiUser(),{action}=await context.params,q=new URL(request.url).searchParams;
 if(action==='tiers')return json(await p.priceTiers(user));
 if(action==='books')return json(await p.listPriceBooks(user));
 if(action==='versions')return json(await p.priceBookVersions(user,q.get('id')??''));
 if(action==='units')return json(await p.productPriceUnits(user,q.get('id')??''));
 if(action==='organization-tier')return json(await p.organizationTier(user,q.get('id')??''));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser(),{action}=await context.params,input=await readJson(request);
 if(action==='tier')return json(await p.savePriceTier(user,input));
 if(action==='assign-tier')return json(await p.assignPriceTier(user,input));
 if(action==='unit')return json(await p.savePriceUnit(user,input));
 if(action==='save')return json(await p.savePriceBook(user,input));
 if(action==='publish')return json(await p.publishPriceBook(user,input));
 if(action==='preview')return json(await p.previewPrice(user,input));
 throw new CrmError('NOT_FOUND',404);
}catch(e){return apiError(e);}}

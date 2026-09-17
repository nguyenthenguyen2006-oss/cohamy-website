import {apiError,apiUser,json,readJson,sameOrigin} from '@/lib/crm/http';
import {CrmError} from '@/lib/crm/permissions';
import {addActivity,assignStaff,changePassword,createTask,getOrder,listOrders,listTasks,manageAccount,updateOrder,updateTask,updateCatalogItem} from '@/lib/crm/work';
import {z} from 'zod';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){try{const user=await apiUser(),{action}=await context.params;const q=Object.fromEntries(new URL(request.url).searchParams);
 if(action==='orders')return json(await listOrders(user,q));
 if(action==='order'&&q.id)return json(await getOrder(user,q.id));
 if(action==='tasks')return json({items:await listTasks(user,q)});
 throw new CrmError('NOT_FOUND',404);
}catch(error){return apiError(error);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);const user=await apiUser(),{action}=await context.params;const data=await readJson(request);
 if(action==='activity')return json(await addActivity(user,data),201);
 if(action==='task')return json(await createTask(user,data),201);
 if(action==='assignment')return json(await assignStaff(user,data));
 if(action==='password')return json(await changePassword(user,data));
 const parsed=z.object({id:z.uuid(),data:z.unknown()}).strict().safeParse(data);if(!parsed.success)throw new CrmError('INVALID_FIELDS',400);
 if(action==='order')return json(await updateOrder(user,parsed.data.id,parsed.data.data));
 if(action==='task-update')return json(await updateTask(user,parsed.data.id,parsed.data.data));
 if(action==='account')return json(await manageAccount(user,parsed.data.id,parsed.data.data));
 if(action==='catalog')return json(await updateCatalogItem(user,parsed.data.id,parsed.data.data));
 throw new CrmError('NOT_FOUND',404);
}catch(error){return apiError(error);}}

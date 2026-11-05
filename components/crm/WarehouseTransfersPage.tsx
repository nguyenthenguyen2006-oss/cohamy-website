import {inventoryTransferWorkspace} from '@/lib/crm/inventory-transfer-workspace';
import type {Principal} from '@/lib/crm/types';
import {WarehouseTransferWorkspace} from './WarehouseTransferWorkspace';

export async function WarehouseTransfersPage({user,query}:{user:Principal;query:Record<string,string|string[]|undefined>}){
 const initialData=await inventoryTransferWorkspace(user,{page:typeof query.page==='string'?query.page:undefined,q:typeof query.q==='string'?query.q:undefined,direction:typeof query.direction==='string'?query.direction:undefined,status:typeof query.status==='string'?query.status:undefined});
 return <WarehouseTransferWorkspace initialData={initialData} canWrite={['ADMIN','MANAGER','WAREHOUSE','WAREHOUSE_HCM','WAREHOUSE_HN'].includes(user.role)}/>;
}

import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import {createQaFixture,qaPassword} from './qa-fixture';
import {database} from '../../lib/crm/db';
import {login} from '../../lib/crm/auth';
import {createPriceProducts,qaPriceDefinition} from './pricing-fixture';
import {savePriceBook,publishPriceBook} from '../../lib/crm/pricing';
import {saveOrderPolicy} from '../../lib/crm/order-policy';
import {saveDistributionRelation} from '../../lib/crm/distribution';
import {createWarehouse} from '../../lib/crm/repository';
import {createLocation,postReceipt} from '../../lib/crm/inventory';

async function main(){
  if(process.env.CRM_ENVIRONMENT!=='LOCAL'||process.env.CRM_DATABASE_MODE!=='pglite'||!/^\.local[\\/]crm-qa-meeting-ui-/.test(process.env.CRM_LOCAL_DATA_DIR??''))throw Error('ISOLATED_MEETING_UI_QA_REQUIRED');
  const ids=await createQaFixture(),admin=(await login('admin@crm-qa.invalid',qaPassword)).user,products=await createPriceProducts(admin),db=await database();
  const book=await savePriceBook(admin,{version:0,name:'QA meeting runtime',definition:qaPriceDefinition,idempotencyKey:randomUUID()});
  await publishPriceBook(admin,{id:book.id,version:book.version,versionId:book.versionId,action:'PUBLISH',reason:'Fictitious UI QA pricing',idempotencyKey:randomUUID()});
  await saveOrderPolicy(admin,{version:0,definition:{enabled:true,requireOwnerApproval:false,alwaysManagerApproval:false,managerApprovalAmount:null,creditRequiresApproval:false,nonSelfApproval:true,acceptedQuotePrice:'UNTIL_QUOTE_EXPIRY',pendingPrice:'UNTIL_REQUEST_EXPIRY',requiredPartnerFields:[],approvalRoles:['ADMIN','MANAGER'],confirmationRoles:['ADMIN','MANAGER','SALES'],provisionalReservation:{mode:'ON_SUBMIT',ttlMinutes:2,allowPartial:true}},reason:'Fictitious UI QA reservation policy',idempotencyKey:randomUUID()});
  await saveDistributionRelation(admin,{parentOrganizationId:ids.dealerA,childOrganizationId:ids.dealerB,reason:'Fictitious UI QA dealer chain',idempotencyKey:randomUUID()});
  await db.query('UPDATE cohamy_crm.warehouses SET organization_id=$1 WHERE id=$2',[admin.organizationId,ids.warehouseA]);
  const sellerWarehouse=await createWarehouse(admin,{organizationId:ids.dealerA,code:'QA_A_SELLER',name:'QA seller A warehouse'});
  for(const [warehouseId,quantity] of [[ids.warehouseA,'50'],[sellerWarehouse.id,'20']] as const){
    const location=await createLocation(admin,{warehouseId,code:'QA_PICK',name:'QA pick',kind:'PICK',idempotencyKey:randomUUID()}) as {id:string};
    await postReceipt(admin,{locationId:location.id,lines:[{productId:products[0],lotCode:'QA_UI_LOT',manufacturedOn:null,expiresOn:null,quantity}],referenceType:'QA',referenceId:randomUUID(),reason:'Fictitious UI stock',idempotencyKey:randomUUID()});
  }
  await fs.writeFile('.local/meeting-runtime-ui.json',JSON.stringify({directory:process.env.CRM_LOCAL_DATA_DIR,dealerA:ids.dealerA,dealerB:ids.dealerB,productId:products[0]},null,2));
  await db.close();console.log('Isolated meeting UI fixture ready.');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'MEETING_UI_SEED_FAILED');process.exitCode=1;});

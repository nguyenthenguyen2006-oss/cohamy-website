import {randomUUID} from 'node:crypto';
import {createQaFixture,qaPassword} from './qa-fixture';
import {database} from '../../lib/crm/db';
import {login} from '../../lib/crm/auth';
import {createAccount} from '../../lib/crm/repository';
import {createPriceProducts,qaPriceDefinition} from './pricing-fixture';
import {savePriceBook,publishPriceBook} from '../../lib/crm/pricing';
import {saveOrderPolicy} from '../../lib/crm/order-policy';
async function main(){
 if(process.env.CRM_ENVIRONMENT!=='LOCAL'||process.env.CRM_DATABASE_MODE!=='pglite'||!/^\.local[\\/]crm-qa-upgrade-ui-orders-/.test(process.env.CRM_LOCAL_DATA_DIR??''))throw Error('ISOLATED_ORDERS_UI_QA_REQUIRED');
 const ids=await createQaFixture(),admin=(await login('admin@crm-qa.invalid',qaPassword)).user;
 await createPriceProducts(admin);const b=await savePriceBook(admin,{version:0,name:'QA hư cấu · Giá đơn hàng',definition:qaPriceDefinition,idempotencyKey:randomUUID()});await publishPriceBook(admin,{id:b.id,version:b.version,versionId:b.versionId,action:'PUBLISH',reason:'QA hư cấu · không áp chính sách thật',idempotencyKey:randomUUID()});
 await createAccount(admin,{email:'staff-order@crm-qa.invalid',displayName:'QA nhân viên đại lý',password:qaPassword,role:'DEALER_STAFF',organizationId:ids.dealerA});
 await createAccount(admin,{email:'manager-order@crm-qa.invalid',displayName:'QA quản lý duyệt đơn',password:qaPassword,role:'MANAGER',organizationId:admin.organizationId});
 await saveOrderPolicy(admin,{version:0,definition:{enabled:true,requireOwnerApproval:true,alwaysManagerApproval:false,managerApprovalAmount:null,creditRequiresApproval:true,nonSelfApproval:true,acceptedQuotePrice:'UNTIL_QUOTE_EXPIRY',pendingPrice:'UNTIL_REQUEST_EXPIRY',requiredPartnerFields:[],approvalRoles:['ADMIN','MANAGER'],confirmationRoles:['ADMIN','MANAGER','SALES']},reason:'QA quy tắc hư cấu chỉ trong dữ liệu kiểm thử riêng',idempotencyKey:randomUUID()});
 await(await database()).close();console.log('LOCAL isolated orders UI fixture seeded; no real policy or provider calls.');
}
main().catch(e=>{console.error(e instanceof Error?e.message:'ORDER_UI_QA_SETUP_FAILED');process.exitCode=1;});

import {randomUUID} from 'node:crypto';
import {createQaFixture,qaPassword} from './qa-fixture';
import {database} from '../../lib/crm/db';
import {login} from '../../lib/crm/auth';
import {createPriceProducts} from './pricing-fixture';
import {createWarehouse} from '../../lib/crm/repository';
import {createLocation,postReceipt} from '../../lib/crm/inventory';

async function main(){
 if(process.env.CRM_ENVIRONMENT!=='LOCAL'||process.env.CRM_DATABASE_MODE!=='pglite'||!/^\.local[\\/]crm-qa-upgrade-ui-samples-/.test(process.env.CRM_LOCAL_DATA_DIR??''))throw Error('ISOLATED_SAMPLE_UI_QA_REQUIRED');
 await createQaFixture();const admin=(await login('admin@crm-qa.invalid',qaPassword)).user,productId=(await createPriceProducts(admin))[0],warehouseId=(await createWarehouse(admin,{code:'QA_SAMPLE_UI',name:'LOCAL QA · Kho mẫu UI',organizationId:admin.organizationId})).id,locationId=(await createLocation(admin,{warehouseId,code:'PICK_SAMPLE_UI',name:'LOCAL QA · Vị trí mẫu UI',idempotencyKey:randomUUID()}) as {id:string}).id;
 await postReceipt(admin,{locationId,lines:[{productId,lotCode:'QA-SAMPLE-UI-LOT',manufacturedOn:'2026-01-01',expiresOn:'2028-12-31',quantity:'100'}],referenceType:'qa-sample-ui',referenceId:'QA-SAMPLE-UI-R1',reason:'LOCAL QA fictitious stock for browser validation',idempotencyKey:randomUUID()});await(await database()).close();console.log('LOCAL sample UI fixture seeded; no real stock or recipients.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

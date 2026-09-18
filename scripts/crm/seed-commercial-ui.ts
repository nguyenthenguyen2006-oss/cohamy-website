import {createQaFixture,qaPassword} from './qa-fixture';
import {database} from '../../lib/crm/db';
import {login} from '../../lib/crm/auth';
import {createPriceProducts,qaPriceDefinition} from './pricing-fixture';
import {savePriceBook,publishPriceBook} from '../../lib/crm/pricing';
async function main(){if(process.env.CRM_ENVIRONMENT!=='LOCAL'||process.env.CRM_DATABASE_MODE!=='pglite'||!/^\.local[\\/]crm-qa-upgrade-ui-pricing-/.test(process.env.CRM_LOCAL_DATA_DIR??''))throw Error('SEPARATE_COMMERCIAL_UI_QA_REQUIRED');await createQaFixture();const admin=(await login('admin@crm-qa.invalid',qaPassword)).user;await createPriceProducts(admin);const b=await savePriceBook(admin,{version:0,name:'QA hư cấu · Bảng giá đang hiệu lực',definition:qaPriceDefinition,idempotencyKey:crypto.randomUUID()});await publishPriceBook(admin,{id:b.id,version:b.version,versionId:b.versionId,action:'PUBLISH',reason:'QA hư cấu · không áp dữ liệu thật',idempotencyKey:crypto.randomUUID()});await(await database()).close();console.log('LOCAL private UI fixture seeded; no provider sends or real policy.');}
main().catch(e=>{console.error(e instanceof Error?e.message:'UI_QA_SETUP_FAILED');process.exitCode=1;});

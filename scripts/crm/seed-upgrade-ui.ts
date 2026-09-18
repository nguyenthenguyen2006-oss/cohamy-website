import {createQaFixture} from './qa-fixture';
import {database} from '../../lib/crm/db';
import {login} from '../../lib/crm/auth';
import {updateCatalogItem} from '../../lib/crm/work';
import {listCatalog} from '../../lib/crm/repository';
async function main(){if(!/^\.local[\\/]crm-qa-upgrade-ui-/.test(process.env.CRM_LOCAL_DATA_DIR??''))throw new Error('SEPARATE_UPGRADE_QA_DIRECTORY_REQUIRED');await createQaFixture();const admin=(await login('admin@crm-qa.invalid','Local-QA-Only-2026!')).user,p=(await listCatalog(admin))[0];await updateCatalogItem(admin,p.id,{version:p.version,sku:'QA-SKU-01',name:p.name,stockUnit:'Gói',unitsPerCase:24,active:true});await(await database()).close();}
main().catch(e=>{console.error(e);process.exitCode=1;});

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { bootstrapAdmin, importWebsiteCatalog, migrate } from "../../lib/crm/bootstrap";
import { database } from "../../lib/crm/db";

export const qaPassword="Local-QA-Only-2026!";
export async function createQaFixture() {
  if(process.env.CRM_ENVIRONMENT!=="LOCAL"||process.env.CRM_DATABASE_MODE!=="pglite"||!process.env.CRM_LOCAL_DATA_DIR?.includes("qa"))throw new Error("QA_REQUIRES_SEPARATE_LOCAL_DATABASE");
  await migrate();await importWebsiteCatalog();
  const db=await database();
  const existing=await db.query<{id:string}>("SELECT id FROM cohamy_crm.users WHERE email='admin@crm-qa.invalid'");
  if(existing.rows.length)throw new Error("QA_FIXTURE_REQUIRES_NEW_DIRECTORY");
  const admin=await bootstrapAdmin("admin@crm-qa.invalid",qaPassword,"LOCAL QA · Quản trị");
  const hash=await bcrypt.hash(qaPassword,12);
  const ids={admin, dealerA:randomUUID(),dealerB:randomUUID(),warehouseA:randomUUID(),warehouseB:randomUUID(),membershipA:randomUUID(),membershipB:randomUUID(),sales:randomUUID(),warehouse:randomUUID(),accountant:randomUUID()};
  await db.transaction(async tx=> {
    for(const [id,code,name] of [[ids.dealerA,"QA_A","LOCAL QA · Đại lý A"],[ids.dealerB,"QA_B","LOCAL QA · Đại lý B"]])await tx.query("INSERT INTO cohamy_crm.organizations(id,code,name,kind) VALUES ($1,$2,$3,'DEALER')",[id,code,name]);
    for(const [id,code,name,org] of [[ids.warehouseA,"QA_KHO_A","LOCAL QA · Kho A",ids.dealerA],[ids.warehouseB,"QA_KHO_B","LOCAL QA · Kho B",ids.dealerB]])await tx.query("INSERT INTO cohamy_crm.warehouses(id,code,name,organization_id) VALUES ($1,$2,$3,$4)",[id,code,name,org]);
    for(const [email,role,org,membership] of [["a@crm-qa.invalid","DEALER_OWNER",ids.dealerA,ids.membershipA],["b@crm-qa.invalid","DEALER_OWNER",ids.dealerB,ids.membershipB],["sales@crm-qa.invalid","SALES",admin.organizationId,ids.sales],["warehouse@crm-qa.invalid","WAREHOUSE",admin.organizationId,ids.warehouse],["accountant@crm-qa.invalid","ACCOUNTANT",admin.organizationId,ids.accountant]]) {
      const user=randomUUID();await tx.query("INSERT INTO cohamy_crm.users(id,email,display_name,password_hash) VALUES ($1,$2,$3,$4)",[user,email,`LOCAL QA · ${role}`,hash]);
      await tx.query("INSERT INTO cohamy_crm.memberships(id,user_id,organization_id,role) VALUES ($1,$2,$3,$4)",[membership,user,org,role]);
    }
    await tx.query("INSERT INTO cohamy_crm.partner_assignments(membership_id,organization_id) VALUES ($1,$2)",[ids.sales,ids.dealerA]);
    await tx.query("INSERT INTO cohamy_crm.warehouse_assignments(membership_id,warehouse_id) VALUES ($1,$2)",[ids.warehouse,ids.warehouseA]);
  });
  return ids;
}

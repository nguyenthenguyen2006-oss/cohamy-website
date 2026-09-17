import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const {migrate,importWebsiteCatalog,bootstrapAdmin}=await import("../../lib/crm/bootstrap");
  const {database}=await import("../../lib/crm/db");
  try {
    await migrate();console.log("CRM migrations applied.");
    if(process.argv.includes("--catalog"))console.log(`Catalog imported: ${await importWebsiteCatalog()} new mappings. No stock/debt imported.`);
    if(process.argv.includes("--bootstrap")) {
      const email=process.env.CRM_BOOTSTRAP_EMAIL,password=process.env.CRM_BOOTSTRAP_PASSWORD;
      if(!email||!password)throw new Error("SET_CRM_BOOTSTRAP_EMAIL_AND_PASSWORD");
      await bootstrapAdmin(email,password,process.env.CRM_BOOTSTRAP_NAME||"Quản trị Cohamy");console.log("Initial administrator created. No password printed.");
    }
  } finally {await (await database()).close();}
}
main().catch(()=>{console.error("CRM init failed. Check dedicated CRM database settings, migration checksums and bootstrap conditions.");process.exitCode=1;});

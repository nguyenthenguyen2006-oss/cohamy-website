process.env.CRM_DATABASE_MODE="pglite";process.env.CRM_ENVIRONMENT="LOCAL";
async function main() {
  if(!process.env.CRM_LOCAL_DATA_DIR)throw new Error("SET_UNIQUE_CRM_LOCAL_DATA_DIR_WITH_QA_LABEL");
  const {createQaFixture}=await import("./qa-fixture");
  const {database}=await import("../../lib/crm/db");
  try {await createQaFixture();console.log("LOCAL QA fixture created. Fictitious .invalid users only; no stock, orders or debt.");}finally{await (await database()).close();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:"QA_FAILED");process.exitCode=1;});

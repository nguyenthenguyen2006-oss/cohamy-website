import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { database } from "./db";
import { audit, digest } from "./auth";
import { products } from "@/data/products";

export async function migrate() {
  const db=await database();
  await db.exec("CREATE SCHEMA IF NOT EXISTS cohamy_crm; CREATE TABLE IF NOT EXISTS cohamy_crm.migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());");
  const directory=path.resolve("db/crm");
  for(const name of (await fs.readdir(directory)).filter(name=>/^\d+.*\.sql$/u.test(name)).sort()) {
    const sql=await fs.readFile(path.join(directory,name),"utf8");const checksum=digest(sql);
    await db.transaction(async tx=> {
      // Lock the migration registry, so two initializers cannot race.
      await tx.exec("LOCK TABLE cohamy_crm.migrations IN EXCLUSIVE MODE");
      const existing=await tx.query<{checksum:string}>("SELECT checksum FROM cohamy_crm.migrations WHERE name=$1",[name]);
      if(existing.rows.length) {if(existing.rows[0].checksum!==checksum)throw new Error("MIGRATION_CHECKSUM_CHANGED");return;}
      await tx.exec(sql);
      await tx.query("INSERT INTO cohamy_crm.migrations(name,checksum) VALUES ($1,$2)",[name,checksum]);
    });
  }
}
export async function importWebsiteCatalog() {
  const db=await database();
  return db.transaction(async tx=> {
    let imported=0;
    for(const product of products) {
      // Stable mapping, not an invented commercial SKU or unit conversion.
      const result=await tx.query<{id:string}>(`INSERT INTO cohamy_crm.products(id,website_id,sku,name,category,weight_label,retail_price,translations)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(website_id) DO NOTHING RETURNING id`,
        [randomUUID(),product.id,`WEB-${product.id}`,product.name.vi,product.category,product.weight,String(product.price),JSON.stringify({name:product.name,slug:product.slug,images:product.images})]);
      imported+=result.rows.length;
    }
    if(imported)await audit(tx,null,"catalog.website-import","website",{imported,status:"CATALOG_ONLY"});
    return imported;
  });
}
export async function bootstrapAdmin(email:string,password:string,displayName:string) {
  z.email().parse(email);if(password.length<12||password.length>72)throw new Error("BOOTSTRAP_PASSWORD_LENGTH");
  const db=await database();const passwordHash=await bcrypt.hash(password,12);
  return db.transaction(async tx=> {
    const count=await tx.query<{total:string}>("SELECT count(*)::text AS total FROM cohamy_crm.users");
    if(count.rows[0].total!=="0")throw new Error("BOOTSTRAP_REQUIRES_EMPTY_USERS");
    const org=randomUUID(),user=randomUUID(),membership=randomUUID();
    await tx.query("INSERT INTO cohamy_crm.organizations(id,code,name,kind) VALUES ($1,'COHAMY','Cohamy','COHAMY')",[org]);
    await tx.query("INSERT INTO cohamy_crm.users(id,email,display_name,password_hash) VALUES ($1,$2,$3,$4)",[user,email.toLowerCase(),displayName,passwordHash]);
    await tx.query("INSERT INTO cohamy_crm.memberships(id,user_id,organization_id,role) VALUES ($1,$2,$3,'ADMIN')",[membership,user,org]);
    await audit(tx,user,"system.bootstrap",org);
    return {organizationId:org,userId:user,membershipId:membership};
  });
}

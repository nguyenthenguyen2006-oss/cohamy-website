import { pageUser } from "@/lib/crm/http";
import { CrmShell } from "@/components/crm/CrmShell";
export default async function Layout({children}:{children:React.ReactNode}) {const user=await pageUser("crm");return <CrmShell user={user}>{children}</CrmShell>;}

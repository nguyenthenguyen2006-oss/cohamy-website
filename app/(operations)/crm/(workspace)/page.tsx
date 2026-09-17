import { pageUser } from "@/lib/crm/http";
import { CrmDashboard } from "@/components/crm/CrmDashboard";
export default async function Page() {return <CrmDashboard user={await pageUser("crm")}/>;}

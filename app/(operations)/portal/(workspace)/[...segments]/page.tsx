import { CrmModulePage } from "@/components/crm/ModulePage";
export default async function Page({params,searchParams}:{params:Promise<{segments:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {return <CrmModulePage area="portal" segments={(await params).segments} query={await searchParams}/>;}

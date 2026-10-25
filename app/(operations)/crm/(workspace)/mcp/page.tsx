import {pageUser} from '@/lib/crm/http';
import {listConnections} from '@/lib/crm/mcp/oauth';
import {McpConnections} from '@/components/crm/McpConnections';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function McpPage(){const user=await pageUser('crm');if(user.role!=='ADMIN')notFound();const items=await listConnections(user);return <section className="work-section" style={{minWidth:0}}><h1>Kết nối ChatGPT / MCP</h1><McpConnections initial={JSON.parse(JSON.stringify(items))}/></section>;}

import {handleMcp,mcpHeaders} from '@/lib/crm/mcp/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=handleMcp;
export const POST=handleMcp;
export const DELETE=handleMcp;
export async function OPTIONS(){return new Response(null,{status:204,headers:{...mcpHeaders(),'Access-Control-Allow-Methods':'POST, GET, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id'}});}

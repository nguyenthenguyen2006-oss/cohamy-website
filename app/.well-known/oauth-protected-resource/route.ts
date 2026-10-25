import {resourceMetadata} from '@/lib/crm/mcp/oauth';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(resourceMetadata(),{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});}

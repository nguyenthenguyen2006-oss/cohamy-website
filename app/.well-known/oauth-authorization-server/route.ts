import {authorizationMetadata} from '@/lib/crm/mcp/oauth';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(authorizationMetadata(),{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});}

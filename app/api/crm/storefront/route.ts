import {apiError, apiUser, json, readJson, sameOrigin} from '@/lib/crm/http';
import {getStorefrontSettings, saveStorefrontSettings} from '@/lib/crm/storefront';

export async function GET() {
  try { return json(await getStorefrontSettings(await apiUser())); }
  catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    return json(await saveStorefrontSettings(await apiUser(), await readJson(request)));
  } catch (error) { return apiError(error); }
}

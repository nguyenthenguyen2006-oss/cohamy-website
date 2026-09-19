const STATIC_CACHE='cohamy-static-v1';
const SHELL=['/offline','/manifest.webmanifest','/icons/cohamy-192.png','/icons/cohamy-512.png','/icons/cohamy-maskable-512.png'];
const PRIVATE_PREFIXES=['/crm','/portal','/api','/admin','/preview'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(STATIC_CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==STATIC_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(url.origin!==self.location.origin||PRIVATE_PREFIXES.some(prefix=>url.pathname===prefix||url.pathname.startsWith(prefix+'/')))return;
 const staticAsset=['style','script','image','font','manifest'].includes(request.destination)||SHELL.includes(url.pathname);if(!staticAsset)return;
 event.respondWith(caches.open(STATIC_CACHE).then(async cache=>{const cached=await cache.match(request);if(cached)return cached;try{const response=await fetch(request);if(response.ok&&response.type==='basic')await cache.put(request,response.clone());return response;}catch(error){if(request.mode==='navigate')return(await cache.match('/offline'))??Response.error();throw error;}}));
});

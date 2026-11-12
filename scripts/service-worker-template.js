const CACHE=/*CACHE_NAME*/;
const ASSETS=/*ASSETS*/;
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
 // Do not skipWaiting or reload a page during a workout. Activate after old tabs close.
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('cindy-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;const url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(async response=>{
   if(response.ok&&!response.redirected){const cache=await caches.open(CACHE);await cache.put('/',response.clone())}
   if(!response.ok) return (await caches.match('/'))||response;
   return response;
  }).catch(()=>caches.match('/')));return;
 }
 if(ASSETS.includes(url.pathname)&&url.pathname!=='/')event.respondWith(caches.match(request).then(hit=>hit||fetch(request)));
});

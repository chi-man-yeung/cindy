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
 if(request.mode==='navigate'&&url.pathname==='/'){
  // Keep HTML paired with this worker's hashed assets. A newer release activates
  // only after all old clients close, never midway through an active workout.
  event.respondWith(caches.open(CACHE).then(cache=>cache.match('/')).then(hit=>hit||fetch(request)));return;
 }
 if(ASSETS.includes(url.pathname)&&url.pathname!=='/')event.respondWith(caches.match(request).then(hit=>hit||fetch(request)));
});

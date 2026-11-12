import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
it('declares standalone navy/white metadata and valid icon dimensions',async()=>{
 const m=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));expect(m).toMatchObject({name:'CINDY',short_name:'CINDY',display:'standalone',theme_color:'#142D4E',background_color:'#FFFFFF',start_url:'/'});
 for(const size of [1024,512,192,180]){const info=await sharp(`public/icons/icon-${size}.png`).metadata();expect(info.width).toBe(size);expect(info.height).toBe(size)}
});
import {runInNewContext} from 'node:vm';
it('pre-caches the shell and serves cached navigation when offline without intercepting writes',async()=>{
 const events:Record<string,(e:any)=>void>={};let installed:string[]=[];const cached={html:'CINDY'};
 const context={URL,self:{location:{origin:'https://cindy.test'},clients:{claim:async()=>{}},addEventListener:(name:string,fn:any)=>events[name]=fn},caches:{open:async()=>({addAll:async(list:string[])=>{installed=list},put:async()=>{}}),match:async()=>cached,keys:async()=>[]},fetch:async()=>{throw new Error('offline')}};
 runInNewContext(readFileSync('scripts/service-worker-template.js','utf8').replace('/*CACHE_NAME*/','"test"').replace('/*ASSETS*/','["/","/_next/static/app.js"]'),context);
 let wait:Promise<any>=Promise.resolve();events.install({waitUntil:(p:Promise<any>)=>wait=p});await wait;expect(installed).toContain('/_next/static/app.js');
 let response:Promise<any>|undefined;events.fetch({request:{method:'GET',mode:'navigate',url:'https://cindy.test/'},respondWith:(p:Promise<any>)=>response=p});expect(await response).toEqual(cached);
 response=undefined;events.fetch({request:{method:'POST',url:'https://cindy.test/'},respondWith:(p:Promise<any>)=>response=p});expect(response).toBeUndefined();
});

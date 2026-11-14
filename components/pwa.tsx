'use client';
import {useEffect,useState} from 'react';
export default function Pwa(){
 const [ready,setReady]=useState(false);const [offline,setOffline]=useState(false);
 useEffect(()=>{
  let alive=true;
  const update=()=>setOffline(!navigator.onLine);update();window.addEventListener('online',update);window.addEventListener('offline',update);
  if(process.env.NODE_ENV==='production'&&'serviceWorker' in navigator){
   void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).then(()=>{if(alive)setReady(true)}).catch(()=>{});
  }
  return()=>{alive=false;window.removeEventListener('online',update);window.removeEventListener('offline',update)};
 },[]);
 return <p className="small muted" role="status">{offline?'Offline · workouts remain on this device':ready?'Offline shell ready · iPhone: Safari → Share → Add to Home Screen':'iPhone: Safari → Share → Add to Home Screen. Open online once before offline use.'}</p>;
}

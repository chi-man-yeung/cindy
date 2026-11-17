'use client';
import {createContext,useCallback,useContext,useEffect,useState,type ReactNode} from 'react';
import {LANGUAGE_KEY,translate,type Language} from '@/lib/i18n/translate';
type LanguageContextValue={language:Language;locale:string;t:(message:string,values?:readonly unknown[])=>string;setLanguage:(language:Language)=>void;date:(value:string)=>string};
const LanguageContext=createContext<LanguageContextValue|null>(null);
const english:LanguageContextValue={language:'en',locale:'en',t:(message,values)=>translate('en',message,values),setLanguage:()=>{},date:value=>new Date(value).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})};
export function LanguageProvider({children}:{children:ReactNode}){
 const [language,setCurrent]=useState<Language>('en');
 useEffect(()=>{
  try{if(localStorage.getItem(LANGUAGE_KEY)==='zh-Hant')setCurrent('zh-Hant')}catch{/* Storage restrictions must not prevent workouts or language switching. */}
  const sync=(event:StorageEvent)=>{if(event.key===LANGUAGE_KEY&&(event.newValue==='en'||event.newValue==='zh-Hant'))setCurrent(event.newValue)};
  window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
 },[]);
 const setLanguage=useCallback((next:Language)=>{setCurrent(next);try{localStorage.setItem(LANGUAGE_KEY,next)}catch{/* The current tab still switches when storage is unavailable. */}},[]);
 const t=useCallback((message:string,values:readonly unknown[]=[])=>translate(language,message,values),[language]);
 const locale=language==='zh-Hant'?'zh-Hant-HK':'en';
 const date=useCallback((value:string)=>new Date(value).toLocaleString(language==='en'?undefined:'zh-Hant-HK',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}),[language]);
 useEffect(()=>{document.documentElement.lang=language;document.title=language==='en'?'CINDY — One more round.':'CINDY — 再多一輪。'},[language]);
 return <LanguageContext.Provider value={{language,locale,t,setLanguage,date}}>{children}</LanguageContext.Provider>;
}
/** Shared by the app layout; also permits standalone screen rendering in tests. */
export function LanguageBoundary({children}:{children:ReactNode}){const context=useContext(LanguageContext);return context?children:<LanguageProvider>{children}</LanguageProvider>}
export const useLanguage=()=>useContext(LanguageContext)??english;
export function LanguageSwitch(){
 const {language,setLanguage}=useLanguage();
 return <div className="language-switch" role="group" aria-label="Language / 語言"><button type="button" lang="en" aria-label="English" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>EN</button><button type="button" lang="zh-Hant" aria-label="繁體中文" aria-pressed={language==='zh-Hant'} onClick={()=>setLanguage('zh-Hant')}>繁中</button></div>;
}

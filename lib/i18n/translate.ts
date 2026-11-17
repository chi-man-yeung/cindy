import chinese from './zh-Hant.json';
export type Language = 'en' | 'zh-Hant';
export const LANGUAGE_KEY = 'cindy-language';
const messages:Record<string,string> = chinese;
const interpolate=(message:string,values:readonly unknown[])=>message.replace(/\{(\d+)\}/g,(token,index)=>index<values.length?String(values[index]):token);
// Also localize existing model labels and validation messages at the presentation boundary.
const patterns=Object.entries(messages).filter(([key])=>/\{\d+\}/.test(key)).sort(([a],[b])=>b.replace(/\{\d+\}/g,'').length-a.replace(/\{\d+\}/g,'').length).map(([key,value])=>{
 const indexes:number[]=[];
 const expression=key.split(/(\{\d+\})/).map(part=>{
  const match=part.match(/^\{(\d+)\}$/);if(match){indexes.push(Number(match[1]));return '(.+?)'}
  return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 }).join('');
 return {expression:new RegExp(`^${expression}$`),indexes,value};
});
export function translate(language:Language,message:string,values:readonly unknown[]=[]):string {
 if(language==='en')return interpolate(message,values);
 if(Object.hasOwn(messages,message))return interpolate(messages[message],values);
 const trimmed=message.trim();if(trimmed!==message)return message.slice(0,message.indexOf(trimmed))+translate(language,trimmed,values)+message.slice(message.indexOf(trimmed)+trimmed.length);
 if(!values.length)for(const pattern of patterns){const match=message.match(pattern.expression);if(match){const args:unknown[]=[];pattern.indexes.forEach((index,i)=>{args[index]=/^(Entry|Preset) \d+: /.test(message)&&i===1?translate(language,match[i+1]):match[i+1]});return interpolate(pattern.value,args)}}
 return interpolate(message,values);
}

import {advance,transition,STANDARD_CINDY,type WorkoutSession,type WorkoutEvent} from './engine';
export const CHELSEA={...STANDARD_CINDY,id:'chelsea-standard-v1',durationMs:30*60_000};
export type MinuteStatus='pending'|'completed'|'missed'|'incomplete'|'not-started';
export interface ChelseaMinute {minute:number;status:MinuteStatus;completedAt:number|null}
export function chelseaMinutes():ChelseaMinute[]{return Array.from({length:30},(_,i)=>({minute:i+1,status:'pending',completedAt:null}))}
export const isChelsea=(s:WorkoutSession)=>s.configuration.id===CHELSEA.id;
export function advanceChelsea(session:WorkoutSession,now:number):WorkoutSession{
 const next=advance(session,now);const terminal=['completed','saved'].includes(next.status);
 const minutes=(session.chelseaMinutes??chelseaMinutes()).map(m=>{
  if(m.status!=='pending')return m;
  if(next.elapsedDurationMs>=m.minute*60_000)return {...m,status:'missed' as const};
  if(terminal)return {...m,status:(next.elapsedDurationMs>=(m.minute-1)*60_000?'incomplete':'not-started') as MinuteStatus};
  return m;
 });
 return {...next,chelseaMinutes:minutes};
}
export function transitionChelsea(session:WorkoutSession,event:WorkoutEvent):WorkoutSession{
 let next=advanceChelsea(session,event.now);
 if(event.type==='round'||event.type==='incomplete'){
  if(next.status!=='running')return next;
  const minute=Math.floor(next.elapsedDurationMs/60_000)+1;
  // The rendered minute is required: a delayed tap can never complete a new minute.
  if(event.minute!==minute)return next;
  const slot=next.chelseaMinutes![minute-1];if(slot.status!=='pending')return next;
  const completed=event.type==='round';
  next={...next,chelseaMinutes:next.chelseaMinutes!.map(m=>m.minute===minute?{...m,status:completed?'completed':'incomplete',completedAt:completed?next.elapsedDurationMs:null}:m)};
  if(completed){const times=[...next.completedRoundTimestamps,next.elapsedDurationMs];next={...next,completedRoundTimestamps:times,totalReps:times.length*30,lastRoundTapAt:event.now}}
  return next;
 }
 if(event.type==='undo')return next; // Chelsea minute results are final once marked.
 if(event.type==='results'&&event.partialReps!==undefined&&event.partialReps!==0)return next;
 next=transition(next,event);return advanceChelsea(next,event.now);
}
export function validateChelsea(s:{configuration:{id:string;durationMs?:number};status?:string;elapsedDurationMs?:number;chelseaMinutes?:ChelseaMinute[];completedRoundTimestamps:(number|null)[];partialReps:number}){
 if(s.configuration.id!==CHELSEA.id)return;
 if(s.configuration.durationMs!==CHELSEA.durationMs)throw new Error('Chelsea requires a 30-minute configuration.');
 const m=s.chelseaMinutes;
 if(!Array.isArray(m)||m.length!==30||s.partialReps!==0)throw new Error('Invalid Chelsea minutes.');
 const times:number[]=[];
 m.forEach((v,i)=>{
  if(!v||v.minute!==i+1||!['pending','completed','missed','incomplete','not-started'].includes(v.status))throw new Error('Invalid Chelsea minute status.');
  const terminal=s.status==='completed'||s.status==='saved';
  const elapsed=s.elapsedDurationMs??0;
  if((terminal&&v.status==='pending')||(v.status==='missed'&&elapsed<(i+1)*60000)||(v.status==='incomplete'&&elapsed<i*60000)||(v.status==='not-started'&&(!terminal||elapsed>=i*60000)))throw new Error('Minute status does not match elapsed time.');
  if(v.status==='completed'){
   if(typeof v.completedAt!=='number'||!Number.isFinite(v.completedAt)||v.completedAt<i*60_000||v.completedAt>=(i+1)*60_000)throw new Error('Late Chelsea completion.');
   times.push(v.completedAt);
  }else if(v.completedAt!==null)throw new Error('Invalid minute timestamp.');
 });
 if(JSON.stringify(times)!==JSON.stringify(s.completedRoundTimestamps))throw new Error('Chelsea score does not match minute records.');
}

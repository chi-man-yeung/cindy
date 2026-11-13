import {advance,transition,STANDARD_CINDY,type WorkoutSession,type WorkoutEvent} from './engine';
export const CHELSEA_LEGACY={...STANDARD_CINDY,id:'chelsea-standard-v1',durationMs:30*60_000};
export type MinuteStatus='pending'|'completed'|'missed'|'incomplete'|'not-started';
export interface ChelseaMinute {minute:number;status:MinuteStatus;completedAt:number|null}
export function chelseaMinutes():ChelseaMinute[]{return Array.from({length:30},(_,i)=>({minute:i+1,status:'pending',completedAt:null}))}
const isLegacyChelsea=(s:WorkoutSession)=>s.configuration.id===CHELSEA_LEGACY.id;
export function advanceLegacyChelsea(session:WorkoutSession,now:number):WorkoutSession{
 const next=advance(session,now);const terminal=['completed','saved'].includes(next.status);
 const minutes=(session.chelseaMinutes??chelseaMinutes()).map(m=>{
  if(m.status!=='pending')return m;
  if(next.elapsedDurationMs>=m.minute*60_000)return {...m,status:'missed' as const};
  if(terminal)return {...m,status:(next.elapsedDurationMs>=(m.minute-1)*60_000?'incomplete':'not-started') as MinuteStatus};
  return m;
 });
 return {...next,chelseaMinutes:minutes};
}
export function transitionLegacyChelsea(session:WorkoutSession,event:WorkoutEvent):WorkoutSession{
 let next=advanceLegacyChelsea(session,event.now);
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
 next=transition(next,event);return advanceLegacyChelsea(next,event.now);
}
function validateLegacyChelsea(s:{configuration:{id:string;durationMs?:number};status?:string;elapsedDurationMs?:number;chelseaMinutes?:ChelseaMinute[];completedRoundTimestamps:(number|null)[];partialReps:number}){
 if(s.configuration.id!==CHELSEA_LEGACY.id)return;
 if(s.configuration.durationMs!==CHELSEA_LEGACY.durationMs)throw new Error('Chelsea requires a 30-minute configuration.');
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


export const CHELSEA={...CHELSEA_LEGACY,id:'chelsea-standard-v2'};
export interface ChelseaScore {version:2;onTimeRounds:number;postTransitionRounds:number;totalRounds:number;transitionElapsedMs:number|null}
export const isChelsea=(s:WorkoutSession)=>s.configuration.id===CHELSEA.id||isLegacyChelsea(s);
export function advanceChelsea(session:WorkoutSession,now:number):WorkoutSession {
 if(!Number.isFinite(now))return session;
 if(isLegacyChelsea(session))return advanceLegacyChelsea(session,now);
 const next=advance(session,now);
 const minutes=structuredClone(session.chelseaMinutes??chelseaMinutes());
 let onTime=0;while(onTime<30&&minutes[onTime].status==='completed')onTime++;
 const boundary=onTime<30?(onTime+1)*60000:null;
 const transitionAt=session.chelseaScore?.transitionElapsedMs??(boundary!==null&&next.elapsedDurationMs>=boundary?boundary:null);
 const terminal=['completed','saved'].includes(next.status);
 if(transitionAt!==null){
  minutes.forEach((m,i)=>{if(i===onTime&&m.status==='pending')m.status='missed';else if(i>onTime)m.status='not-started'});
 }else if(terminal){minutes.forEach((m,i)=>{if(m.status==='pending')m.status=next.elapsedDurationMs>=i*60000?'incomplete':'not-started'})}
 const total=next.completedRoundTimestamps.length+(next.additionalCompletedRounds??0);
 return {...next,chelseaMinutes:minutes,chelseaScore:{version:2,onTimeRounds:onTime,postTransitionRounds:total-onTime,totalRounds:total,transitionElapsedMs:transitionAt}};
}
export function transitionChelsea(session:WorkoutSession,event:WorkoutEvent):WorkoutSession {
 if(!Number.isFinite(event.now))return session;
 if(isLegacyChelsea(session))return transitionLegacyChelsea(session,event);
 let next=advanceChelsea(session,event.now);
 const inAmrap=next.chelseaScore!.transitionElapsedMs!==null;
 if(event.type==='round'){
  if(next.status!=='running')return next;
  if(inAmrap)return advanceChelsea(transition(next,event),event.now);
  const minute=Math.floor(next.elapsedDurationMs/60000)+1;
  if(event.minute!==minute||next.chelseaMinutes![minute-1]?.status!=='pending')return next;
  const before=next.completedRoundTimestamps.length;next=transition(next,event);
  if(next.completedRoundTimestamps.length===before)return advanceChelsea(next,event.now);
  next={...next,chelseaMinutes:next.chelseaMinutes!.map(m=>m.minute===minute?{...m,status:'completed',completedAt:next.elapsedDurationMs}:m)};
  return advanceChelsea(next,event.now);
 }
 if(event.type==='incomplete'){
  const minute=Math.floor(next.elapsedDurationMs/60000)+1;
  if(next.status==='running'&&!inAmrap&&event.minute===minute&&next.chelseaMinutes![minute-1]?.status==='pending')return {...next,chelseaMinutes:next.chelseaMinutes!.map(m=>m.minute===minute?{...m,status:'incomplete'}:m)};
  return next;
 }
 if(event.type==='undo')return next;
 if(event.type==='results'&&((event.partialReps??0)>29||next.chelseaScore!.onTimeRounds===30&&(event.partialReps??0)!==0))return next;
 return advanceChelsea(transition(next,event),event.now);
}
export function validateChelsea(s:Parameters<typeof validateLegacyChelsea>[0]&{chelseaScore?:ChelseaScore;completedRounds?:number;additionalCompletedRounds?:number}) {
 if(s.configuration.id!==CHELSEA.id){
  if(s.chelseaScore){
   if(s.configuration.id.startsWith('chelsea-')&&s.configuration.id!==CHELSEA_LEGACY.id){validateChelsea({...s,configuration:{...s.configuration,id:CHELSEA.id}});return}
   throw new Error('Chelsea scoring metadata does not match the configuration.');
  }
  validateLegacyChelsea(s);return;
 }
 const score=s.chelseaScore,minutes=s.chelseaMinutes;
 if(s.configuration.durationMs!==1800000||!score||score.version!==2||!Array.isArray(minutes)||minutes.length!==30)throw new Error('Invalid Chelsea benchmark metadata.');
 let onTime=0;while(onTime<30&&minutes[onTime]?.status==='completed')onTime++;
 const total=s.completedRounds??s.completedRoundTimestamps.length+(s.additionalCompletedRounds??0);
 if(score.onTimeRounds!==onTime||score.totalRounds!==total||score.postTransitionRounds!==total-onTime||total<onTime||s.partialReps<0||s.partialReps>29||(onTime===30&&s.partialReps!==0))throw new Error('Invalid Chelsea scoring.');
 const elapsed=s.elapsedDurationMs??0;const boundary=onTime<30?(onTime+1)*60000:null;
 const expected=boundary!==null&&elapsed>=boundary?boundary:null;
 if(score.transitionElapsedMs!==expected||(expected===null&&total!==onTime))throw new Error('Invalid Chelsea transition deadline.');
 minutes.forEach((m,i)=>{
  if(m.minute!==i+1)throw new Error('Invalid Chelsea ledger.');
  if(i<onTime){if(m.completedAt!==s.completedRoundTimestamps[i]||typeof m.completedAt!=='number'||m.completedAt<i*60000||m.completedAt>=(i+1)*60000)throw new Error('Invalid on-time round.');}
  else {
   if(m.completedAt!==null||!['pending','missed','incomplete','not-started'].includes(m.status))throw new Error('Invalid Chelsea minute.');
   if(expected===null&&((m.status==='pending'&&['completed','saved'].includes(s.status??''))||(m.status==='not-started'&&(!['completed','saved'].includes(s.status??'')||elapsed>=i*60000))||(m.status==='incomplete'&&(i!==onTime||elapsed<i*60000))||m.status==='missed'))throw new Error('Invalid pre-transition minute.');
   if(expected!==null&&((i===onTime&&!['missed','incomplete'].includes(m.status))||(i>onTime&&m.status!=='not-started')))throw new Error('EMOM cannot restart after failure.');
  }
 });
 s.completedRoundTimestamps.slice(onTime).forEach(t=>{if(t===null||expected===null||t<expected||t>=1800000||t>elapsed)throw new Error('Invalid AMRAP round.');});
}

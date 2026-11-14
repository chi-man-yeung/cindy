import {advance,transition,ROUND_TAP_GUARD_MS,type WorkoutEvent,type WorkoutSession} from './engine';
import {isCustomEmom,validConfiguration} from './custom-config';
export interface CustomInterval {interval:number;startMs:number;endMs:number;status:'pending'|'completed'|'missed'|'incomplete'|'not-started';completedAt:number|null}
export function intervalPlan(s:{configuration:WorkoutSession['configuration']}):CustomInterval[]{
 const c=s.configuration;const interval=c.training!.intervalMs;
 return Array.from({length:Math.ceil(c.durationMs/interval)},(_,i)=>({interval:i+1,startMs:i*interval,endMs:Math.min((i+1)*interval,c.durationMs),status:'pending',completedAt:null}));
}
export function advanceCustom(session:WorkoutSession,now:number):WorkoutSession{
 if(!Number.isFinite(now))return session;
 const next=advance(session,now),terminal=['completed','saved'].includes(next.status);
 const intervals=(session.customIntervals??intervalPlan(session)).map(i=>{
  if(i.status!=='pending')return i;
  if(next.elapsedDurationMs>=i.endMs)return {...i,status:'missed' as const};
  if(terminal)return {...i,status:next.elapsedDurationMs>=i.startMs?'incomplete' as const:'not-started' as const};
  return i;
 });
 return {...next,customIntervals:intervals,totalReps:next.completedRoundTimestamps.length*next.configuration.repsPerRound};
}
export function transitionCustom(session:WorkoutSession,event:WorkoutEvent):WorkoutSession{
 if(!Number.isFinite(event.now))return session;
 let next=advanceCustom(session,event.now);
 if(event.type==='round'){
  if(next.status!=='running'||(next.lastRoundTapAt!==null&&Math.max(event.now,next.lastObservedAt)-next.lastRoundTapAt<ROUND_TAP_GUARD_MS))return next;
  const current=Math.floor(next.elapsedDurationMs/next.configuration.training!.intervalMs)+1;
  const slot=next.customIntervals![current-1];
  if(event.minute!==current||!slot||slot.status!=='pending')return next;
  const time=next.elapsedDurationMs;
  next={...next,customIntervals:next.customIntervals!.map(i=>i.interval===current?{...i,status:'completed',completedAt:time}:i),completedRoundTimestamps:[...next.completedRoundTimestamps,time],lastRoundTapAt:Math.max(event.now,next.lastObservedAt)};
  return advanceCustom(next,event.now);
 }
 if(event.type==='undo'||event.type==='incomplete')return next;
 if(event.type==='results'&&event.partialReps!==undefined&&event.partialReps!==0)return next;
 return advanceCustom(transition(next,event),event.now);
}
export function validateCustom(s:{configuration:WorkoutSession['configuration'];customIntervals?:CustomInterval[];status:string;elapsedDurationMs:number;completedRoundTimestamps:(number|null)[];partialReps:number;totalReps:number;additionalCompletedRounds?:number;chelseaScore?:unknown;chelseaMinutes?:unknown}){
 if(!isCustomEmom(s.configuration)){if(s.customIntervals!==undefined)throw new Error('Training intervals require Custom EMOM.');return}
 if(!validConfiguration(s.configuration)||s.partialReps!==0||(s.additionalCompletedRounds??0)!==0||s.chelseaScore||s.chelseaMinutes)throw new Error('Invalid training session.');
 const plan=intervalPlan(s),items=s.customIntervals;const terminal=['completed','saved'].includes(s.status);
 if(!Array.isArray(items)||items.length!==plan.length)throw new Error('Invalid interval plan.');
 const completed:number[]=[];
 items.forEach((item,index)=>{
  const p=plan[index];if(!item||item.interval!==p.interval||item.startMs!==p.startMs||item.endMs!==p.endMs)throw new Error('Invalid interval schedule.');
  if(item.status==='completed'){
   const t=item.completedAt;if(typeof t!=='number'||!Number.isFinite(t)||t<p.startMs||t>=p.endMs||t>s.elapsedDurationMs)throw new Error('Late interval completion.');completed.push(t);
  }else{
   const expected=s.elapsedDurationMs>=p.endMs?'missed':terminal?(s.elapsedDurationMs>=p.startMs?'incomplete':'not-started'):'pending';
   if(item.status!==expected||item.completedAt!==null)throw new Error('Interval status does not match time.');
  }
 });
 if(JSON.stringify(completed)!==JSON.stringify(s.completedRoundTimestamps)||s.totalReps!==completed.length*s.configuration.repsPerRound)throw new Error('Training volume does not match completions.');
}
export function trainingSummary(s:{customIntervals?:CustomInterval[];totalReps:number}){
 const intervals=s.customIntervals??[];const completed=intervals.filter(i=>i.status==='completed').length;
 return {planned:intervals.length,completed,missed:intervals.filter(i=>i.status==='missed').length,incomplete:intervals.filter(i=>i.status==='incomplete').length,completionRate:intervals.length?Math.round(completed/intervals.length*100):0,totalVolume:s.totalReps};
}

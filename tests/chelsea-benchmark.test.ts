import 'fake-indexeddb/auto';
import {beforeEach,expect,it} from 'vitest';
import {CHELSEA,CHELSEA_LEGACY,advanceChelsea,transitionChelsea} from '../lib/workout/chelsea';
import {createWorkout,configurationKey} from '../lib/workout/engine';
import {validateSession} from '../lib/workout/validation';
import {analytics,bestByConfiguration} from '../lib/history/analytics';
import {recordFromSession,validateSavedWorkout} from '../lib/history/model';
import {exportBackup,parseBackup} from '../lib/history/backup';
import {persistActiveSession,loadActiveSession,closeWorkoutDatabase} from '../lib/workout/storage';
import {saveCompletedWorkout,listSavedWorkouts,updateWorkoutNotes,deleteWorkout,mergeBackup} from '../lib/history/repository';
import {clearTestData} from './history-fixtures';
const T=1700000000000,S=T+5000;
const start=(id='new',config=CHELSEA)=>transitionChelsea(createWorkout(id,T,config),{type:'start',now:T});
function rounds(n:number,id='new'){let s=start(id);for(let i=0;i<n;i++)s=transitionChelsea(s,{type:'round',minute:i+1,now:S+i*60000+1000});return s}
function finish(onTime:number,post:number,partial=0,id='test'){
 let s=rounds(onTime,id);for(let i=0;i<post;i++)s=transitionChelsea(s,{type:'round',minute:onTime+1,now:S+(onTime+1)*60000+i*1000});
 s=advanceChelsea(s,S+1800000);return transitionChelsea(s,{type:'results',now:S+1800000,partialReps:partial});
}
beforeEach(clearTestData);
it('clean 30/30 remains EMOM throughout and represents full completion',()=>{
 const s=advanceChelsea(rounds(30),S+1800000);expect(s.chelseaScore).toEqual({version:2,onTimeRounds:30,postTransitionRounds:0,totalRounds:30,transitionElapsedMs:null});expect(s.totalReps).toBe(900);expect(validateSession(s)).toEqual(s);
});
it('fails minute 18, continues the unfinished round, then counts eight additional complete rounds',()=>{
 let s=rounds(17);s=advanceChelsea(s,S+18*60000-1);expect(s.chelseaScore!.transitionElapsedMs).toBeNull();
 const startTime=s.startTime;s=advanceChelsea(s,S+18*60000);expect(s.startTime).toBe(startTime);expect(s.elapsedDurationMs).toBe(1080000);expect(s.chelseaScore!.transitionElapsedMs).toBe(1080000);
 s=finish(17,8,16);expect(s.chelseaScore).toMatchObject({onTimeRounds:17,postTransitionRounds:8,totalRounds:25});expect(s.totalReps).toBe(766);expect(s.partialReps).toBe(16);expect(validateSession(s)).toEqual(s);
});
it('a completion exactly at the first deadline is AMRAP, never on-time',()=>{
 const s=transitionChelsea(start(),{type:'round',minute:1,now:S+60000});expect(s.chelseaScore).toMatchObject({onTimeRounds:0,postTransitionRounds:1,totalRounds:1,transitionElapsedMs:60000});
});
it('does not resume EMOM or restart an unfinished round at subsequent boundaries',()=>{
 let s=advanceChelsea(start(),S+60000);s=transitionChelsea(s,{type:'round',minute:1,now:S+150000});expect(s.chelseaScore!.postTransitionRounds).toBe(1);
 s=transitionChelsea(s,{type:'round',minute:2,now:S+180000});expect(s.chelseaScore).toMatchObject({onTimeRounds:0,postTransitionRounds:2,transitionElapsedMs:60000});
});
it('accepts final 0–29 partials and refuses a full-round tap at the 30-minute boundary',()=>{
 let s=rounds(17);s=transitionChelsea(s,{type:'round',minute:18,now:S+1800000});expect(s.completedRoundTimestamps).toHaveLength(17);
 s=transitionChelsea(s,{type:'results',now:S+1800000,partialReps:29});expect(s.totalReps).toBe(539);expect(recordFromSession(s).exerciseBreakdown).toEqual({pullUps:5,pushUps:10,airSquats:14});
});
it('retains pause accounting and recovers the exact missed deadline after suspension',async()=>{
 let s=rounds(17);s=transitionChelsea(s,{type:'pause',now:S+17*60000+1000});s=advanceChelsea(s,S+2000000);expect(s.chelseaScore!.transitionElapsedMs).toBeNull();
 s=transitionChelsea(s,{type:'resume',now:S+2000000});await persistActiveSession(s);await closeWorkoutDatabase();
 const r=advanceChelsea((await loadActiveSession())!,S+2100000);expect(r.chelseaScore!.transitionElapsedMs).toBe(1080000);expect(r.startTime).toBe(S);expect(validateSession(r)).toEqual(r);
});
it('recovers preparation suspended beyond the entire workout without extending the timer',()=>{
 const s=advanceChelsea(start(),S+3000000);expect(s.endTime).toBe(S+1800000);expect(s.chelseaScore!.transitionElapsedMs).toBe(60000);expect(validateSession(s)).toEqual(s);
});
it('guards rapid AMRAP taps and repeated results edits',()=>{
 let s=transitionChelsea(start(),{type:'round',now:S+60000,minute:1});s=transitionChelsea(s,{type:'round',now:S+60001,minute:1});expect(s.totalReps).toBe(30);
 s=advanceChelsea(s,S+1800000);s=transitionChelsea(s,{type:'results',now:S+1800000,partialReps:15});s=transitionChelsea(s,{type:'results',now:S+1800000,notes:'finish'});expect(s.totalReps).toBe(45);
});
it('ranks consecutive on-time rounds first, then completed rounds, then partial reps',()=>{
 const records=[recordFromSession(finish(16,20,29,'lower')),recordFromSession(finish(17,1,1,'a')),recordFromSession(finish(17,2,0,'b')),recordFromSession(finish(17,2,1,'c'))];
 expect(analytics(records,CHELSEA).best?.id).toBe('c');expect(bestByConfiguration(records).get(configurationKey(CHELSEA))?.id).toBe('c');
 expect(analytics(records.slice(0,2),CHELSEA).best?.id).toBe('a');expect(analytics(records.slice(0,3),CHELSEA).best?.id).toBe('b');
});
it('preserves legacy sessions and isolates legacy/scaled records from standard Chelsea PB',async()=>{
 let old=start('legacy',CHELSEA_LEGACY);old=transitionChelsea(old,{type:'round',minute:2,now:S+61000});old=advanceChelsea(old,S+1800000);
 await saveCompletedWorkout(old);const legacy=(await listSavedWorkouts())[0];expect(legacy.chelseaScore).toBeUndefined();expect(legacy.completedRounds).toBe(1);
 const standard=recordFromSession(finish(17,8,29,'standard'));
 const scaled=validateSavedWorkout({...standard,id:'scaled',configuration:{...standard.configuration,id:'chelsea-scaled-v2'}});
 await mergeBackup(parseBackup(exportBackup([standard,scaled])));expect(analytics(await listSavedWorkouts(),CHELSEA).count).toBe(1);expect((await listSavedWorkouts()).find(r=>r.id==='legacy')).toEqual(legacy);
});
it('round-trips scoring through history, backup, notes edits and deletion/PB recalculation',async()=>{
 await saveCompletedWorkout(finish(17,8,29,'best'));await saveCompletedWorkout(finish(16,9,29,'other'));await closeWorkoutDatabase();
 const records=await listSavedWorkouts();expect(parseBackup(exportBackup(records)).records).toEqual(records);
 await updateWorkoutNotes('best','new notes');expect((await listSavedWorkouts()).find(r=>r.id==='best')!.chelseaScore!.postTransitionRounds).toBe(8);
 await deleteWorkout('best');expect(analytics(await listSavedWorkouts(),CHELSEA).best?.id).toBe('other');
});
it('rejects inconsistent transition metadata and late on-time timestamps on import',()=>{
 const r=recordFromSession(finish(17,8));expect(()=>validateSavedWorkout({...r,chelseaScore:{...r.chelseaScore!,transitionElapsedMs:60000}})).toThrow();
 expect(()=>validateSavedWorkout({...r,chelseaScore:{...r.chelseaScore!,onTimeRounds:18}})).toThrow();
});
it('ignores invalid timestamps without mutating minute status',()=>{
 const s=rounds(1);expect(transitionChelsea(s,{type:'incomplete',minute:1,now:NaN})).toEqual(s);expect(advanceChelsea(s,Infinity)).toEqual(s);
});
import {comparePerformance} from '../lib/history/analytics';
it('cannot compare scaled and standard directly or attach Chelsea scoring to Cindy',()=>{
 const record=recordFromSession(finish(17,8));const scaled=validateSavedWorkout({...record,configuration:{...record.configuration,id:'chelsea-scaled-v2'}});
 expect(()=>comparePerformance(record,scaled)).toThrow('different');
 expect(()=>validateSavedWorkout({...record,configuration:{...record.configuration,id:'cindy-standard-v1'}})).toThrow('metadata');
});

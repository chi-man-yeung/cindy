import 'fake-indexeddb/auto';
import {beforeEach,expect,it} from 'vitest';
import {createWorkout,configurationKey,STANDARD_CINDY} from '../lib/workout/engine';
import {customConfiguration,DEFAULT_CUSTOM,validConfiguration} from '../lib/workout/custom-config';
import {advanceCustom,transitionCustom,trainingSummary} from '../lib/workout/custom-emom';
import {validateSession} from '../lib/workout/validation';
import {recordFromSession,validateSavedWorkout} from '../lib/history/model';
import {analytics,bestByConfiguration,comparePerformance} from '../lib/history/analytics';
import {persistActiveSession,loadActiveSession,closeWorkoutDatabase,openWorkoutDatabase} from '../lib/workout/storage';
import {listPresets,savePreset} from '../lib/workout/presets';
import {saveCompletedWorkout,listSavedWorkouts,mergeBackup,updateWorkoutNotes,deleteWorkout} from '../lib/history/repository';
import {exportBackup,parseBackup} from '../lib/history/backup';
import {BASE,clearTestData,completed} from './history-fixtures';
const S=BASE+5000;
const config=(seconds=60)=>customConfiguration(5,seconds,[{name:'burpees',reps:7},{name:'sit-ups',reps:12}]);
const start=(seconds=60)=>transitionCustom(createWorkout('training',BASE,config(seconds)),{type:'start',now:BASE});
async function clear(){await clearTestData();const db=await openWorkoutDatabase();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('presets','readwrite');tx.objectStore('presets').clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
beforeEach(clear);
it.each([5,10,30])('validates %i-minute setup and preserves exercise order',minutes=>{
 const c=customConfiguration(minutes,90,[{name:'lunges',reps:20},{name:'squats',reps:10}].map(m=>({...m,name:m.name==='squats'?'air-squats':m.name})));
 expect(validConfiguration(c)).toBe(true);expect(c.movements.map(m=>m.name)).toEqual(['lunges','air-squats']);expect(c.repsPerRound).toBe(30);
});
it.each([4,31,5.5,NaN])('rejects invalid duration %s',minutes=>{expect(()=>customConfiguration(minutes,60,[{name:'burpees',reps:5}])).toThrow()});
it.each([0,59,61,120])('rejects invalid interval %i',interval=>{expect(()=>customConfiguration(5,interval,[{name:'burpees',reps:5}])).toThrow()});
it('rejects empty/unbounded/unknown exercise prescriptions and forged benchmark markers',()=>{
 for(const exercises of [[],[{name:'rowing',reps:5}],[{name:'pull-ups',reps:0}],[{name:'pull-ups',reps:1001}],[{name:'pull-ups',reps:1.5}],Array(13).fill({name:'burpees',reps:1})])expect(()=>customConfiguration(5,60,exercises)).toThrow();
 expect(validConfiguration({...DEFAULT_CUSTOM,id:STANDARD_CINDY.id})).toBe(false);
});
it.each([60,90])('uses five-second prep and exact %i-second boundaries without resetting the clock',seconds=>{
 let s=start(seconds);expect(s.status).toBe('preparing');expect(advanceCustom(s,S-1).status).toBe('preparing');
 s=transitionCustom(s,{type:'round',minute:1,now:S+seconds*1000-1});expect(s.totalReps).toBe(19);
 s=transitionCustom(s,{type:'round',minute:1,now:S+seconds*1000});expect(s.completedRoundTimestamps).toHaveLength(1);
 s=transitionCustom(s,{type:'round',minute:2,now:S+seconds*1000+1000});expect(s.totalReps).toBe(38);expect(s.startTime).toBe(S);expect(validateSession(s)).toEqual(s);
});
it('counts one tap per interval and rejects stale/duplicate taps',()=>{
 let s=transitionCustom(start(),{type:'round',minute:1,now:S+1000});s=transitionCustom(s,{type:'round',minute:1,now:S+1001});expect(s.totalReps).toBe(19);
 s=transitionCustom(s,{type:'round',minute:1,now:S+60001});expect(s.totalReps).toBe(19);expect(s.customIntervals![1].status).toBe('pending');
});
it('marks all suspended missed intervals but does not progress targets or reset start',()=>{
 const s=advanceCustom(start(),S+181000);expect(s.customIntervals!.filter(i=>i.status==='missed')).toHaveLength(3);expect(s.configuration).toEqual(config());expect(s.startTime).toBe(S);
});
it('plans a shortened final interval for 5 minutes / 90 seconds and enforces its deadline',()=>{
 let s=start(90);expect(s.customIntervals!.map(i=>i.endMs-i.startMs)).toEqual([90000,90000,90000,30000]);
 s=transitionCustom(s,{type:'round',minute:4,now:S+299999});expect(s.totalReps).toBe(19);
 s=transitionCustom(s,{type:'round',minute:4,now:S+300000});expect(s.status).toBe('completed');expect(s.elapsedDurationMs).toBe(300000);expect(s.totalReps).toBe(19);
});
it('finishes early with incomplete/not-started intervals and a planned-denominator rate',()=>{
 let s=transitionCustom(start(),{type:'round',minute:1,now:S+1000});s=transitionCustom(s,{type:'finish',now:S+61000});
 expect(s.customIntervals!.map(i=>i.status)).toEqual(['completed','incomplete','not-started','not-started','not-started']);
 expect(trainingSummary(s)).toMatchObject({completed:1,planned:5,completionRate:20,totalVolume:19});expect(validateSession(s)).toEqual(s);
});
it('excludes paused time, restores from IndexedDB and resolves expiry after suspension',async()=>{
 let s=transitionCustom(start(),{type:'pause',now:S+1000});s=advanceCustom(s,S+900000);expect(s.elapsedDurationMs).toBe(1000);expect(s.customIntervals![0].status).toBe('pending');
 s=transitionCustom(s,{type:'resume',now:S+900000});await persistActiveSession(s);await closeWorkoutDatabase();
 const restored=advanceCustom((await loadActiveSession())!,S+1200000);expect(restored.status).toBe('completed');expect(restored.endTime).toBe(S+1199000);expect(validateSession(restored)).toEqual(restored);
});
it('refuses after-deadline completion and records no volume for unfinished work',()=>{
 const s=transitionCustom(start(),{type:'round',minute:5,now:S+300000});expect(s.totalReps).toBe(0);expect(trainingSummary(s).missed).toBe(5);
});
it('persists/reuses and explicitly updates presets without modifying history',async()=>{
 const p=await savePreset('Burpee focus',config(90));await closeWorkoutDatabase();expect((await listPresets())[0]).toEqual(p);
 await savePreset('Updated focus',config(60),p.id);expect(await listPresets()).toHaveLength(1);expect((await listPresets())[0].configuration.training!.intervalMs).toBe(60000);expect(await listSavedWorkouts()).toHaveLength(0);
});
it('rejects bad presets without changing existing presets',async()=>{
 await savePreset('Good',config());await expect(savePreset(' ',config())).rejects.toThrow();await expect(savePreset('Bad',STANDARD_CINDY)).rejects.toThrow();expect(await listPresets()).toHaveLength(1);
});
it('saves incomplete training, edits notes, exports/restores with legacy records and skips duplicates',async()=>{
 let s=transitionCustom(start(),{type:'round',minute:1,now:S+1000});s=transitionCustom(s,{type:'finish',now:S+61000});
 await saveCompletedWorkout(s);await saveCompletedWorkout(completed('benchmark'));await updateWorkoutNotes('training','Technique day');await closeWorkoutDatabase();
 const records=await listSavedWorkouts();expect(parseBackup(exportBackup(records)).records).toEqual(records);expect((await mergeBackup(parseBackup(exportBackup(records)))).duplicates).toBe(2);
 const training=records.find(r=>r.id==='training')!;expect(training.configuration.movements).toEqual(config().movements);expect(training.customIntervals).toHaveLength(5);expect(training.totalReps).toBe(19);
 await deleteWorkout('training');expect((await listSavedWorkouts()).map(r=>r.id)).toEqual(['benchmark']);expect(await listPresets()).toHaveLength(0);
});
it('never ranks training as a PB or changes Cindy analytics',()=>{
 const s=transitionCustom(transitionCustom(start(),{type:'round',minute:1,now:S+1000}),{type:'finish',now:S+2000});const r=recordFromSession(s);
 expect(analytics([r],r.configuration).best).toBeNull();expect(bestByConfiguration([r]).size).toBe(0);expect(()=>comparePerformance(r,r)).toThrow('no benchmark');expect(analytics([r],STANDARD_CINDY).count).toBe(0);
 expect(configurationKey(config(60))).not.toBe(configurationKey(config(90)));
});
it('rejects forged volume, missing ledgers and invalid interval timestamps on import',()=>{
 const r=recordFromSession(advanceCustom(start(),S+300000));for(const patch of [{totalReps:100},{customIntervals:[]},{customIntervals:r.customIntervals!.map((i,n)=>n?i:{...i,status:'completed',completedAt:60000})}])expect(()=>validateSavedWorkout({...r,...patch})).toThrow();
});
it('results edits cannot introduce partial reps or alter the prescribed volume',()=>{
 let s=transitionCustom(transitionCustom(start(),{type:'round',minute:1,now:S+1000}),{type:'finish',now:S+2000});s=transitionCustom(s,{type:'results',now:S+3000,notes:'Done',perceivedEffort:7});expect(s.totalReps).toBe(19);expect(s.notes).toBe('Done');
 expect(transitionCustom(s,{type:'results',now:S+3000,partialReps:29}).partialReps).toBe(0);
});
it('exports training with version 2 while preserving version-1 benchmark backups',()=>{
 const s=advanceCustom(start(),S+300000);const r=recordFromSession(s);expect(JSON.parse(exportBackup([r])).schemaVersion).toBe(2);expect(parseBackup(exportBackup([r])).records).toEqual([r]);
 const legacy=recordFromSession(completed('legacy'));expect(JSON.parse(exportBackup([legacy])).schemaVersion).toBe(1);expect(parseBackup(exportBackup([legacy])).records).toEqual([legacy]);
 expect(()=>parseBackup(JSON.stringify({schemaVersion:3,exportedAt:new Date().toISOString(),sessions:[]}))).toThrow();
});
it('keeps presets intact when an update transaction fails',async()=>{
 const p=await savePreset('Original',config());const original=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){if(this.name==='presets')throw new Error('quota');return original.apply(this,args)};
 try{await expect(savePreset('Changed',config(90),p.id)).rejects.toThrow('quota')}finally{IDBObjectStore.prototype.put=original}
 expect((await listPresets())[0].name).toBe('Original');
});

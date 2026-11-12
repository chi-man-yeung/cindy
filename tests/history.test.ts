import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analytics, newestFirst, roundSplits } from '../lib/history/analytics';
import { exportBackup, parseBackup } from '../lib/history/backup';
import { configurationLabel, validateSavedWorkout } from '../lib/history/model';
import { deleteWorkout, listSavedWorkouts, mergeBackup, saveCompletedWorkout, updateWorkoutNotes } from '../lib/history/repository';
import { closeWorkoutDatabase, loadActiveSession, persistActiveSession } from '../lib/workout/storage';
import { createWorkout, STANDARD_CINDY } from '../lib/workout/engine';
import { BASE, clearTestData, completed, saved } from './history-fixtures';
beforeEach(clearTestData);
describe('saved-session persistence',()=>{
 it('saves completed score/configuration/timestamps/notes and reopens after a browser-style connection restart',async()=>{
  const session=completed('saved',3,17);
  await persistActiveSession(session);
  const result=await saveCompletedWorkout(session);
  expect(result.duplicate).toBe(false);expect(result.record.completedRounds).toBe(3);expect(result.record.totalReps).toBe(107);
  await closeWorkoutDatabase();
  expect((await listSavedWorkouts())[0]).toEqual(result.record);
  expect((await loadActiveSession())?.status).toBe('saved');
 });
 it('rejects active workouts and keeps them out of history',async()=>{
  await expect(saveCompletedWorkout(createWorkout('idle',BASE))).rejects.toThrow('Finish');
  expect(await listSavedWorkouts()).toEqual([]);
 });
 it('handles simultaneous duplicate saves without overwrites',async()=>{
  const results=await Promise.all([saveCompletedWorkout(completed('same')),saveCompletedWorkout(completed('same',3))]);
  expect(results.map(r=>r.duplicate)).toEqual([false,true]);
  expect((await listSavedWorkouts())[0].completedRounds).toBe(2);expect(await listSavedWorkouts()).toHaveLength(1);
 });
 it('edits only the selected notes, persists them after restart, and preserves score',async()=>{
  await saveCompletedWorkout(completed('one'));await saveCompletedWorkout(completed('two'));
  const before=(await listSavedWorkouts()).find(r=>r.id==='one')!;
  await updateWorkoutNotes('one','Updated pacing');await closeWorkoutDatabase();
  const records=await listSavedWorkouts();const one=records.find(r=>r.id==='one')!;
  expect(one.notes).toBe('Updated pacing');expect(one.totalReps).toBe(before.totalReps);
  expect(records.find(r=>r.id==='two')?.notes).toBe('Original notes');
 });
 it('rejects oversized notes and cannot recreate a missing record through an edit',async()=>{
  await expect(updateWorkoutNotes('missing','hello')).rejects.toThrow('no longer exists');
  await expect(updateWorkoutNotes('missing','x'.repeat(2001))).rejects.toThrow('2,000');
  expect(await listSavedWorkouts()).toHaveLength(0);
 });
 it('reports failed writes without inserting a record',async()=>{
  const spy=vi.spyOn(IDBDatabase.prototype,'transaction').mockImplementationOnce(()=>{throw new Error('unavailable')});
  await expect(saveCompletedWorkout(completed())).rejects.toThrow('unavailable');spy.mockRestore();
  expect(await listSavedWorkouts()).toHaveLength(0);
 });
});
describe('individual deletion',()=>{
 it('deletes exactly one stable ID, retains other records with the same date, and stays deleted after restart',async()=>{
  await saveCompletedWorkout(completed('one'));await saveCompletedWorkout(completed('two',3));
  await persistActiveSession({...completed('one'),status:'saved'});
  await deleteWorkout('one');await closeWorkoutDatabase();
  expect((await listSavedWorkouts()).map(r=>r.id)).toEqual(['two']);expect(await loadActiveSession()).toBeNull();
  await expect(saveCompletedWorkout(completed('one'))).rejects.toThrow('deleted');
  await persistActiveSession({...completed('one'),status:'saved'});expect(await loadActiveSession()).toBeNull();
 });
 it('does not delete or overwrite a different active workout',async()=>{
  await saveCompletedWorkout(completed('old'));await persistActiveSession(createWorkout('current',BASE));
  await deleteWorkout('old');expect((await loadActiveSession())?.id).toBe('current');
 });
 it('keeps deleted IDs excluded when restoring an older backup',async()=>{
  const old=saved('old');await mergeBackup(parseBackup(exportBackup([old])));await deleteWorkout('old');
  const report=await mergeBackup(parseBackup(exportBackup([old,saved('new')])));
  expect(report.deleted).toBe(1);expect(report.imported).toBe(1);expect((await listSavedWorkouts()).map(r=>r.id)).toEqual(['new']);
 });
 it('fails without deleting any record when a transaction cannot open',async()=>{
  await saveCompletedWorkout(completed('one'));
  const spy=vi.spyOn(IDBDatabase.prototype,'transaction').mockImplementationOnce(()=>{throw new Error('unavailable')});
  await expect(deleteWorkout('one')).rejects.toThrow();spy.mockRestore();expect(await listSavedWorkouts()).toHaveLength(1);
 });
 it('does not resurrect a record through a later notes edit',async()=>{
  await saveCompletedWorkout(completed('one'));await deleteWorkout('one');
  await expect(updateWorkoutNotes('one','resurrect')).rejects.toThrow();expect(await listSavedWorkouts()).toHaveLength(0);
 });
});
describe('backup and merge',()=>{
 it('round-trips exported JSON without mutating records and reports duplicates',async()=>{
  await saveCompletedWorkout(completed('one',3,29));
  const records=await listSavedWorkouts();const text=exportBackup(records);
  expect(JSON.parse(text).schemaVersion).toBe(1);expect(parseBackup(text).records).toEqual(records);
  const report=await mergeBackup(parseBackup(text));expect(report.duplicates).toBe(1);expect(report.imported).toBe(0);
 });
 it('merges new records and skips conflicting IDs without replacing notes or scores',async()=>{
  const original=saved('one');await mergeBackup(parseBackup(exportBackup([original])));
  const report=await mergeBackup(parseBackup(exportBackup([{...original,notes:'conflicting'},saved('two',3)])));
  expect(report.imported).toBe(1);expect(report.conflicts).toBe(1);expect((await listSavedWorkouts()).find(r=>r.id==='one')?.notes).toBe('Original notes');
 });
 it('rejects malformed entries while importing other valid entries',async()=>{
  const report=await mergeBackup(parseBackup(JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),sessions:[saved('good'),{...saved('bad'),totalReps:9999},null]})));
  expect(report.imported).toBe(1);expect(report.rejected).toBe(2);expect(report.issues).toHaveLength(2);
 });
 it.each(['not json','null','[]','{"schemaVersion":2,"sessions":[]}','{"schemaVersion":1,"exportedAt":"bad","sessions":[]}'])('rejects malformed backup envelope %s',text=>{
  expect(()=>parseBackup(text)).toThrow();
 });
 it('bounds input size and session count',()=>{
  expect(()=>parseBackup(' '.repeat(10*1024*1024+1))).toThrow('10 MB');
  expect(()=>parseBackup(JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),sessions:Array(10_001).fill(null)}))).toThrow('10,000');
 });
 it('handles duplicate/conflicting IDs within a file deterministically',async()=>{
  const one=saved('one');const parsed=parseBackup(exportBackup([one,one,{...one,notes:'conflicting'}]));
  expect(parsed.records).toHaveLength(1);expect(parsed.duplicates).toBe(1);expect(parsed.conflicts).toBe(1);
  expect((await mergeBackup(parsed)).imported).toBe(1);
 });
 it('never exports the active workout',async()=>{
  await persistActiveSession(createWorkout('active',BASE));
  expect(JSON.parse(exportBackup(await listSavedWorkouts())).sessions).toEqual([]);
 });
 it('aborts the entire merge if a write fails midway',async()=>{
  const original=IDBObjectStore.prototype.add;
  const spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['add']>){
   if((args[0] as {id:string}).id==='two')throw new Error('write failed');return original.apply(this,args);
  });
  await expect(mergeBackup(parseBackup(exportBackup([saved('one'),saved('two')])))).rejects.toThrow('write failed');spy.mockRestore();
  expect(await listSavedWorkouts()).toHaveLength(0);
 });
});
describe('analytics and missing splits',()=>{
 it('sorts by full date/time with deterministic ties without changing input',()=>{
  const input=[saved('a',2,0,BASE),saved('c',2,0,BASE+10000),saved('b',2,0,BASE)];
  expect(newestFirst(input).map(r=>r.id)).toEqual(['c','a','b']);expect(input[0].id).toBe('a');
 });
 it('uses total reps for best and compares the latest two sessions of exactly one configuration',()=>{
  const config={...STANDARD_CINDY,id:'custom',durationMs:30000};
  const records=[saved('old',2,0,BASE),saved('latest',2,15,BASE+1000),saved('custom',20,29,BASE+2000,config)];
  const a=analytics(records,STANDARD_CINDY);
  expect(a.count).toBe(2);expect(a.best?.id).toBe('latest');expect(a.latest?.totalReps).toBe(75);expect(a.delta).toBe(15);
  expect(a.chart.map(p=>p.reps)).toEqual([60,75]);expect(a.chart.map(p=>p.date)).toEqual([BASE,BASE+1000]);
  expect(configurationLabel(config)).toContain('Custom');
 });
 it('recalculates PB, counts, chart and delta after deletion and import',async()=>{
  await mergeBackup(parseBackup(exportBackup([saved('a',2,0,BASE),saved('b',3,0,BASE+1000)])));
  expect(analytics(await listSavedWorkouts(),STANDARD_CINDY).best?.id).toBe('b');await deleteWorkout('b');
  const after=analytics(await listSavedWorkouts(),STANDARD_CINDY);expect(after.best?.id).toBe('a');expect(after.count).toBe(1);expect(after.delta).toBeNull();expect(after.chart).toHaveLength(1);
  await mergeBackup(parseBackup(exportBackup([saved('c',4,0,BASE+2000)])));
  const imported=analytics(await listSavedWorkouts(),STANDARD_CINDY);expect(imported.best?.id).toBe('c');expect(imported.delta).toBe(60);
 });
 it('handles empty/single-session analytics and chooses the newest PB in a tie',()=>{
  expect(analytics([],STANDARD_CINDY)).toMatchObject({count:0,best:null,latest:null,delta:null,chart:[]});
  expect(analytics([saved('a')],STANDARD_CINDY).delta).toBeNull();
  expect(analytics([saved('old',2,0,BASE),saved('new',2,0,BASE+1000)],STANDARD_CINDY).best?.id).toBe('new');
 });
 it('calculates individual splits from elapsed timestamps and never estimates missing data',()=>{
  const record=saved('one',3);expect(roundSplits(record).map(r=>r.durationMs)).toEqual([1000,1000,1000]);
  expect(roundSplits({...record,completedRoundTimestamps:[1000,null,3000]}).map(r=>r.durationMs)).toEqual([1000,null,null]);
  const noSplits={...record};delete (noSplits as Partial<typeof noSplits>).completedRoundTimestamps;
  expect(roundSplits(validateSavedWorkout(noSplits)).map(r=>r.durationMs)).toEqual([null,null,null]);
 });
 it.each([{status:'running'},{partialReps:30},{completedRounds:-1},{completedRoundTimestamps:[-1,1000]},{elapsedDurationMs:50},{configuration:{...STANDARD_CINDY,durationMs:0}}])('rejects malformed record %j',patch=>{
  expect(()=>validateSavedWorkout({...saved(),...patch})).toThrow();
 });
});

describe('atomic save and optional fields',()=>{
 it('aborts history save if its active saved marker cannot be committed',async()=>{
  const session=completed('atomic');await persistActiveSession(session);
  const put=IDBObjectStore.prototype.put;
  const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['put']>){
   if(this.name==='active-session' && (args[0] as {status:string}).status==='saved')throw new Error('marker failed');
   return put.apply(this,args);
  });
  await expect(saveCompletedWorkout(session)).rejects.toThrow('marker failed');spy.mockRestore();
  expect(await listSavedWorkouts()).toHaveLength(0);expect((await loadActiveSession())?.status).toBe('completed');
 });
 it('accepts missing optional notes/effort while rejecting missing required score data',()=>{
  const record=saved('optional') as Partial<ReturnType<typeof saved>>;
  delete record.notes;delete record.perceivedEffort;
  expect(validateSavedWorkout(record)).toMatchObject({notes:'',perceivedEffort:null});
  delete record.totalReps;expect(()=>validateSavedWorkout(record)).toThrow();
 });
 it('keeps a separate best per exact custom/development configuration',async()=>{
  const dev={...STANDARD_CINDY,id:'cindy-development-30s-v1',durationMs:30000};
  await mergeBackup(parseBackup(exportBackup([saved('standard',2),saved('development',10,0,BASE+1000,dev)])));
  expect(analytics(await listSavedWorkouts(),STANDARD_CINDY).best?.id).toBe('standard');
  expect(analytics(await listSavedWorkouts(),dev).best?.id).toBe('development');
 });
});

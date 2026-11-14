import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { advance, createWorkout, transition } from '../lib/workout/engine';
import { loadActiveSession, persistActiveSession } from '../lib/workout/storage';
const T=100_000;
const preparing=()=>transition(createWorkout('persisted-id',T),{type:'start',now:T});
beforeEach(async()=>{await persistActiveSession(null)});
describe('IndexedDB active-session storage',()=>{
 it('returns null on a fresh installation',async()=>{expect(await loadActiveSession()).toBeNull()});
 it('round-trips preparation, rounds, pauses and completed results drafts',async()=>{
  let s=preparing();
  for(const status of ['preparing','running','paused','completed'] as const) {
   if(status==='running')s=transition(advance(s,T+5000),{type:'round',now:T+6000});
   if(status==='paused')s=transition(s,{type:'pause',now:T+7000});
   if(status==='completed') {
    s=transition(s,{type:'finish',now:T+8000});
    s=transition(s,{type:'results',now:T+8000,partialReps:29,notes:'Retained draft',perceivedEffort:9});
   }
   await persistActiveSession(s);expect(await loadActiveSession()).toEqual(s);
  }
 });
 it('restores after deadline and preserves original start and end',async()=>{
  await persistActiveSession(preparing());
  const restored=advance((await loadActiveSession())!,T+2_000_000);
  expect(restored.status).toBe('completed');expect(restored.endTime).toBe(T+5000+1_200_000);
 });
 it('clears only the active slot when preparation is cancelled',async()=>{
  await persistActiveSession(preparing());await persistActiveSession(null);expect(await loadActiveSession()).toBeNull();
 });
 it('rejects malformed writes before replacing valid data',async()=>{
  await persistActiveSession(preparing());
  await expect(persistActiveSession({...preparing(),totalReps:999})).rejects.toThrow();
  expect((await loadActiveSession())?.id).toBe('persisted-id');
 });
 it('reports transaction failures and permits later recovery',async()=>{
  const spy=vi.spyOn(IDBDatabase.prototype,'transaction').mockImplementationOnce(()=>{throw new Error('storage unavailable')});
  await expect(persistActiveSession(preparing())).rejects.toThrow('storage unavailable');
  spy.mockRestore();await persistActiveSession(preparing());expect(await loadActiveSession()).not.toBeNull();
 });
 it('detects corrupt stored data without deleting it',async()=>{
  const request=indexedDB.open('cindy-workouts',3);
  await new Promise<void>((resolve,reject)=>{
   request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{
    const db=request.result;const tx=db.transaction('active-session','readwrite');
    tx.objectStore('active-session').put({schemaVersion:999},'current');
    tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error);
   };
  });
  await expect(loadActiveSession()).rejects.toThrow();
  await expect(loadActiveSession()).rejects.toThrow();
 });
});

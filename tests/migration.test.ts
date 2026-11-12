import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { completed } from './history-fixtures';
import { closeWorkoutDatabase, loadActiveSession, openWorkoutDatabase } from '../lib/workout/storage';
import { listSavedWorkouts, saveCompletedWorkout } from '../lib/history/repository';
it('migrates a Phase 2 version-1 database without losing its active draft',async()=>{
 const session=completed('phase-two-draft');
 await new Promise<void>((resolve,reject)=>{
  const request=indexedDB.open('cindy-workouts',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('active-session');
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result;const tx=db.transaction('active-session','readwrite');tx.objectStore('active-session').put(session,'current');tx.oncomplete=()=>{db.close();resolve()}};
 });
 expect(await loadActiveSession()).toEqual(session);
 expect((await openWorkoutDatabase()).version).toBe(2);
 expect(await listSavedWorkouts()).toEqual([]);
 await saveCompletedWorkout(session);await closeWorkoutDatabase();
 expect((await listSavedWorkouts())[0].id).toBe('phase-two-draft');expect((await loadActiveSession())?.id).toBe('phase-two-draft');
});

import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {saved,completed} from './history-fixtures';
import {listPresets} from '../lib/workout/presets';
import {listSavedWorkouts} from '../lib/history/repository';
import {loadActiveSession,openWorkoutDatabase} from '../lib/workout/storage';
it('adds presets to a version-2 database without resetting saved/active workouts or deletion markers',async()=>{
 const record=saved('old'),draft=completed('active');
 await new Promise<void>((resolve,reject)=>{const request=indexedDB.open('cindy-workouts',2);request.onupgradeneeded=()=>{for(const name of ['sessions','active-session','deleted-sessions'])request.result.createObjectStore(name)};request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction(['sessions','active-session','deleted-sessions'],'readwrite');tx.objectStore('sessions').put(record,record.id);tx.objectStore('active-session').put(draft,'current');tx.objectStore('deleted-sessions').put({id:'deleted'},'deleted');tx.oncomplete=()=>{db.close();resolve()}}});
 expect(await listPresets()).toEqual([]);expect((await openWorkoutDatabase()).version).toBe(3);expect(await listSavedWorkouts()).toEqual([record]);expect(await loadActiveSession()).toEqual(draft);
 const db=await openWorkoutDatabase();const deleted=await new Promise(resolve=>{const tx=db.transaction('deleted-sessions');const req=tx.objectStore('deleted-sessions').get('deleted');tx.oncomplete=()=>resolve(req.result)});expect(deleted).toEqual({id:'deleted'});
});

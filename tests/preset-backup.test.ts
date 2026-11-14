import 'fake-indexeddb/auto';
import {beforeEach,it,expect,vi} from 'vitest';
import {exportBackup,parseBackup} from '../lib/history/backup';
import {mergeBackup,listSavedWorkouts} from '../lib/history/repository';
import {savePreset,listPresets} from '../lib/workout/presets';
import {DEFAULT_CUSTOM} from '../lib/workout/custom-config';
import {openWorkoutDatabase,closeWorkoutDatabase} from '../lib/workout/storage';
import {clearTestData,saved} from './history-fixtures';
beforeEach(async()=>{await clearTestData();const db=await openWorkoutDatabase();await new Promise<void>(resolve=>{const tx=db.transaction('presets','readwrite');tx.objectStore('presets').clear();tx.oncomplete=()=>resolve()})});
it('exports presets with sessions, restores both and retains them after reopen',async()=>{
 const preset=await savePreset('Strength',DEFAULT_CUSTOM);const record=saved('benchmark');const text=exportBackup([record],Date.now(),[preset]);expect(JSON.parse(text).schemaVersion).toBe(3);
 const db=await openWorkoutDatabase();await new Promise<void>(resolve=>{const tx=db.transaction('presets','readwrite');tx.objectStore('presets').clear();tx.oncomplete=()=>resolve()});
 const report=await mergeBackup(parseBackup(text));expect(report.imported).toBe(1);expect(report.presets.imported).toBe(1);await closeWorkoutDatabase();expect(await listPresets()).toEqual([preset]);expect(await listSavedWorkouts()).toEqual([record]);
});
it('supports preset-only restore and skips existing identical and conflicting IDs without overwrites',async()=>{
 const preset=await savePreset('Keep me',DEFAULT_CUSTOM);const parsed=parseBackup(exportBackup([],Date.now(),[preset,preset,{...preset,name:'Conflict'}]));expect(parsed.presetReport).toMatchObject({duplicates:1,conflicts:1});
 const first=await mergeBackup(parsed);expect(first.presets).toMatchObject({imported:0,duplicates:2,conflicts:1});
 const second=await mergeBackup(parseBackup(exportBackup([],Date.now(),[{...preset,name:'Changed'}])));expect(second.presets.conflicts).toBe(1);expect(await listPresets()).toEqual([preset]);
});
it('preserves same-name presets with distinct IDs and rejects malformed presets independently',async()=>{
 const p=await savePreset('Name',DEFAULT_CUSTOM);const text=JSON.stringify({schemaVersion:3,exportedAt:new Date().toISOString(),sessions:[saved('ok')],presets:[{...p,id:'new'},null,{...p,id:'bad',configuration:{...DEFAULT_CUSTOM,durationMs:1}},{...p,id:'time',updatedAt:0}]});
 const parsed=parseBackup(text);expect(parsed.presetReport.rejected).toBe(3);expect(parsed.issues).toHaveLength(3);const result=await mergeBackup(parsed);expect(result.imported).toBe(1);expect(result.presets.imported).toBe(1);expect(await listPresets()).toHaveLength(2);
});
it('reads old backups without changing presets and rejects invalid preset envelopes',async()=>{
 const p=await savePreset('Existing',DEFAULT_CUSTOM);
 for(const schemaVersion of [1,2]){const parsed=parseBackup(JSON.stringify({schemaVersion,exportedAt:new Date().toISOString(),sessions:[]}));expect(parsed.presets).toEqual([]);await mergeBackup(parsed)}expect(await listPresets()).toEqual([p]);
 for(const presets of [undefined,{},Array(10001).fill(null)])expect(()=>parseBackup(JSON.stringify({schemaVersion:3,exportedAt:new Date().toISOString(),sessions:[],presets}))).toThrow();
});
it('revalidates preset candidates at the write boundary and rolls back sessions if a preset write fails',async()=>{
 const p=await savePreset('Existing',DEFAULT_CUSTOM);const parsed=parseBackup(exportBackup([saved('never-added')],Date.now(),[{...p,id:'new'}]));
 await expect(mergeBackup({...parsed,presets:[{...p,name:''}]})).rejects.toThrow();
 const original=IDBObjectStore.prototype.add;const spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['add']>){if(this.name==='presets')throw new Error('preset write failed');return original.apply(this,args)});
 try{await expect(mergeBackup(parsed)).rejects.toThrow('preset write failed')}finally{spy.mockRestore()}
 expect(await listSavedWorkouts()).toEqual([]);expect(await listPresets()).toEqual([p]);
 const sessionFailure=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['add']>){if(this.name==='sessions')throw new Error('session write failed');return original.apply(this,args)});
 try{await expect(mergeBackup(parsed)).rejects.toThrow('session write failed')}finally{sessionFailure.mockRestore()}
 expect(await listSavedWorkouts()).toEqual([]);expect(await listPresets()).toEqual([p]);
});

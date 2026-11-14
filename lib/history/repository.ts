import {validatePreset} from '../workout/presets';
import { openWorkoutDatabase } from '../workout/storage';
import type { WorkoutSession } from '../workout/engine';
import { newestFirst } from './analytics';
import { recordFromSession, validateSavedWorkout, type SavedWorkout } from './model';
import { type ImportReport, type ParsedBackup } from './backup';

const SESSIONS='sessions';
const DELETED='deleted-sessions';
export async function listSavedWorkouts():Promise<SavedWorkout[]> {
 const db=await openWorkoutDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(SESSIONS,'readonly');const request=tx.objectStore(SESSIONS).getAll();
  tx.oncomplete=()=>{try{resolve(newestFirst(request.result.map(validateSavedWorkout)))}catch(error){reject(error)}};
  tx.onerror=tx.onabort=()=>reject(tx.error??new Error('Could not load history.'));
 });
}
export async function saveCompletedWorkout(session:WorkoutSession):Promise<{record:SavedWorkout;duplicate:boolean}> {
 const candidate=recordFromSession(session);
 const db=await openWorkoutDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction([SESSIONS,DELETED,'active-session'],'readwrite');
  const store=tx.objectStore(SESSIONS);let result:{record:SavedWorkout;duplicate:boolean};let failure:Error|null=null;
  const deleted=tx.objectStore(DELETED).get(candidate.id);
  deleted.onsuccess=()=>{
   if(deleted.result){failure=new Error('This record was deleted. Start a new workout to save another session.');return}
   const existing=store.get(candidate.id);
   existing.onsuccess=()=>{
    try {
     if(existing.result)result={record:validateSavedWorkout(existing.result),duplicate:true};
     else {store.add(candidate,candidate.id);result={record:candidate,duplicate:false}}
     // Commit the saved lifecycle marker with the history record, so a refresh
     // cannot reopen an editable results draft after history has been saved.
     const active=tx.objectStore('active-session');const current=active.get('current');
     current.onsuccess=()=>{
      try {
       if(!current.result) active.put({...session,status:'saved'},'current');
       else if(current.result.id===candidate.id && current.result.status==='completed') active.put({...current.result,status:'saved'},'current');
      }catch(error){failure=error as Error;tx.abort()}
     };
    }catch(error){failure=error as Error;tx.abort()}
   };
  };
  tx.oncomplete=()=>failure?reject(failure):resolve(result);
  tx.onerror=tx.onabort=()=>reject(failure??tx.error??new Error('Workout was not saved.'));
 });
}
export async function updateWorkoutNotes(id:string,notes:string):Promise<SavedWorkout> {
 if(typeof notes!=='string' || notes.length>2000)throw new Error('Notes must be at most 2,000 characters.');
 const db=await openWorkoutDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction([SESSIONS,'active-session'],'readwrite');const store=tx.objectStore(SESSIONS);
  let result:SavedWorkout;let failure:Error|null=null;
  const request=store.get(id);
  request.onsuccess=()=>{
   try {
    if(!request.result){failure=new Error('This workout no longer exists.');return}
    result=validateSavedWorkout({...request.result,notes,notesUpdatedAt:Math.max(Date.now(),request.result.savedAt)});
    store.put(result,id);
    const active=tx.objectStore('active-session');const current=active.get('current');
    current.onsuccess=()=>{try{if(current.result?.id===id && current.result.status==='saved') active.put({...current.result,notes},'current')}catch(error){failure=error as Error;tx.abort()}};
   }catch(error){failure=error as Error;tx.abort()}
  };
  tx.oncomplete=()=>failure?reject(failure):resolve(result);
  tx.onerror=tx.onabort=()=>reject(failure??tx.error??new Error('Notes were not saved.'));
 });
}
/** No bulk-delete API. This transaction targets exactly one stable session ID. */
export async function deleteWorkout(id:string):Promise<void> {
 const db=await openWorkoutDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction([SESSIONS,DELETED,'active-session'],'readwrite');
  tx.objectStore(SESSIONS).delete(id);
  tx.objectStore(DELETED).put({id,deletedAt:Date.now()},id);
  const active=tx.objectStore('active-session');const current=active.get('current');
  current.onsuccess=()=>{if(current.result?.id===id && ['saved','completed'].includes(current.result.status)) active.delete('current')};
  tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error??new Error('Workout was not deleted.'));
 });
}
export async function mergeBackup(parsed:ParsedBackup):Promise<ImportReport> {
 // Validate again at the write boundary, even for an already previewed object.
 const candidates=parsed.records.map(validateSavedWorkout);
 const presetCandidates=parsed.presets.map(validatePreset);
 const db=await openWorkoutDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction([SESSIONS,DELETED,'presets'],'readwrite');const store=tx.objectStore(SESSIONS);
  const report:ImportReport={presets:{...parsed.presetReport},imported:0,duplicates:parsed.duplicates,conflicts:parsed.conflicts,deleted:0,rejected:parsed.rejected,issues:[...parsed.issues]};
  let failure:Error|null=null;
  const records=store.getAll();const deleted=tx.objectStore(DELETED).getAllKeys();const presetStore=tx.objectStore('presets');const presets=presetStore.getAll();let ready=0;
  const apply=()=>{
   if(++ready!==3)return;
   try {
    const existing=new Map(records.result.map(value=>{const r=validateSavedWorkout(value);return [r.id,r]}));
    const deletedIds=new Set(deleted.result);
    const existingPresets=new Map(presets.result.map(value=>{const p=validatePreset(value);return [p.id,p]}));
    for(const preset of presetCandidates){
     const previous=existingPresets.get(preset.id);
     if(previous){
      if(JSON.stringify(previous)===JSON.stringify(preset))report.presets.duplicates++;
      else {report.presets.conflicts++;report.issues.push(`Preset ID ${preset.id}: existing preset kept; backup version skipped.`)}
     }else {presetStore.add(preset,preset.id);existingPresets.set(preset.id,preset);report.presets.imported++}
    }
    for(const record of candidates){
     if(deletedIds.has(record.id)){report.deleted++;continue}
     const previous=existing.get(record.id);
     if(previous){
      if(JSON.stringify(previous)===JSON.stringify(record))report.duplicates++;
      else {report.conflicts++;report.issues.push(`ID ${record.id}: existing record kept; backup version skipped.`)}
     }else {store.add(record,record.id);existing.set(record.id,record);report.imported++}
    }
   }catch(error){failure=error as Error;tx.abort()}
  };
  records.onsuccess=apply;deleted.onsuccess=apply;presets.onsuccess=apply;
  tx.oncomplete=()=>resolve(report);tx.onerror=tx.onabort=()=>reject(failure??tx.error??new Error('Import failed; no records were changed.'));
 });
}

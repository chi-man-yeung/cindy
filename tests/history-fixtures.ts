import { advance, createWorkout, STANDARD_CINDY, transition, type WorkoutConfiguration } from '../lib/workout/engine';
import { recordFromSession } from '../lib/history/model';
import { openWorkoutDatabase } from '../lib/workout/storage';
export const BASE=1_700_000_000_000;
export function completed(id='session',rounds=2,partial=0,at=BASE,config:WorkoutConfiguration=STANDARD_CINDY){
 let s=advance(transition(createWorkout(id,at,config),{type:'start',now:at}),at+5000);
 for(let i=1;i<=rounds;i++)s=transition(s,{type:'round',now:at+5000+i*1000});
 s=advance(s,at+5000+config.durationMs);
 return transition(s,{type:'results',now:at+5000+config.durationMs,partialReps:partial,notes:'Original notes'});
}
export const saved=(id='session',rounds=2,partial=0,at=BASE,config:WorkoutConfiguration=STANDARD_CINDY)=>recordFromSession(completed(id,rounds,partial,at,config),at+config.durationMs+6000);
/** Test-only cleanup; the application intentionally has no bulk deletion API. */
export async function clearTestData(){
 const db=await openWorkoutDatabase();
 await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(['active-session','sessions','deleted-sessions'],'readwrite');
  for(const name of ['active-session','sessions','deleted-sessions'])tx.objectStore(name).clear();
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
 });
}

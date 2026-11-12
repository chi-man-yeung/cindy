import { configurationKey, type WorkoutConfiguration } from '../workout/engine';
import type { SavedWorkout } from './model';
export function newestFirst(records: readonly SavedWorkout[]): SavedWorkout[] {
  return [...records].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date) || a.id.localeCompare(b.id));
}
export function analytics(records: readonly SavedWorkout[], configuration: WorkoutConfiguration) {
  const comparable = newestFirst(records.filter(r=>configurationKey(r.configuration)===configurationKey(configuration)));
  const latest = comparable[0] ?? null;
  const previous = comparable[1] ?? null;
  const best = comparable.reduce<SavedWorkout|null>((best,r)=>!best || r.totalReps>best.totalReps ? r : best,null);
  return {count:comparable.length,latest,previous,best,delta:latest && previous ? latest.totalReps-previous.totalReps : null,
    chart:[...comparable].reverse().map(r=>({id:r.id,date:Date.parse(r.date),reps:r.totalReps}))};
}
export function roundSplits(record: SavedWorkout) {
  return Array.from({length:record.completedRounds},(_,i)=>{
    const elapsed = record.completedRoundTimestamps[i] ?? null;
    const previous = i===0 ? 0 : record.completedRoundTimestamps[i-1] ?? null;
    return {round:i+1,elapsedMs:elapsed,durationMs:elapsed===null || previous===null ? null : elapsed-previous};
  });
}
export function bestByConfiguration(records:readonly SavedWorkout[]):Map<string,SavedWorkout>{
 const best=new Map<string,SavedWorkout>();
 for(const record of newestFirst(records)){
  const key=configurationKey(record.configuration);
  if(!best.has(key)||best.get(key)!.totalReps<record.totalReps)best.set(key,record);
 }
 return best;
}

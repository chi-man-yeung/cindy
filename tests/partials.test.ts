import {expect,it} from 'vitest';
import {breakdown,partialTotal} from '../lib/workout/partials';
import {completed} from './history-fixtures';
import {transition} from '../lib/workout/engine';
import {recordFromSession,validateSavedWorkout} from '../lib/history/model';
it.each([0,1,5,6,15,16,29,30])('normalizes %i sequential reps and survives serialization',n=>{
 expect(partialTotal(breakdown(n))).toBe(n);
 const s=transition(completed('partial',2),{type:'results',now:Date.now(),partialReps:n});
 const r=recordFromSession(s);expect(r.totalReps).toBe(60+n);expect(r.completedRounds).toBe(n===30?3:2);expect(r.partialReps).toBe(n%30);
 expect(validateSavedWorkout(JSON.parse(JSON.stringify(r)))).toEqual(r);
});
it('rejects invalid exercise order',()=>{expect(()=>partialTotal({pullUps:4,pushUps:1,airSquats:0})).toThrow();expect(()=>partialTotal({pullUps:5,pushUps:9,airSquats:1})).toThrow()});
import 'fake-indexeddb/auto';
import {persistActiveSession,loadActiveSession} from '../lib/workout/storage';
it('retains the normalized additional round across an IndexedDB reopen/read',async()=>{
 const s=transition(completed('normalized',2),{type:'results',now:Date.now(),partialReps:30});
 await persistActiveSession(s);const recovered=await loadActiveSession();expect(recovered?.totalReps).toBe(90);expect(recordFromSession(recovered!).completedRoundTimestamps).toEqual([1000,2000,null]);
});

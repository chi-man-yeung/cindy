import { describe, expect, it, vi } from 'vitest';
import { advance, configurationKey, createWorkout, developmentConfiguration, elapsedTime, formatDuration, preparationCue, ROUND_TAP_GUARD_MS, score, STANDARD_CINDY, transition, type WorkoutSession } from '../lib/workout/engine';
import { validateSession } from '../lib/workout/validation';
const T = 100_000;
const START = T + 5000;
const END = START + 1_200_000;
const prep = () => transition(createWorkout('test',T),{type:'start',now:T});
const running = () => advance(prep(),START);
const event = (s:WorkoutSession,type:'round'|'pause'|'resume'|'undo'|'finish',now:number) => transition(s,{type,now});

describe('five-second preparation',()=>{
 it('starts idle and displays 5,4,3,2,1 without consuming workout time',()=>{
  expect(createWorkout('test',T).status).toBe('idle');
  for(let second=0;second<5;second++) {
   const s=advance(prep(),T+second*1000);
   expect(s.status).toBe('preparing');
   expect(preparationCue(s,T+second*1000)).toBe(String(5-second));
   expect(s.startTime).toBeNull();expect(s.elapsedDurationMs).toBe(0);
   expect(validateSession(s)).toEqual(s);
  }
  expect(advance(prep(),START-1).status).toBe('preparing');
 });
 it('shows GO and starts exactly at five seconds, then shows time',()=>{
  const s=advance(prep(),START);
  expect(s.startTime).toBe(START);expect(s.elapsedDurationMs).toBe(0);
  expect(preparationCue(s,START)).toBe('GO');
  expect(preparationCue(advance(s,START+800),START+800)).toBeNull();
 });
 it('ignores round, pause, resume and finish before GO',()=>{
  for(const type of ['round','pause','resume','finish'] as const) {
   const s=event(prep(),type,T+1000);
   expect(s.status).toBe('preparing');expect(s.totalReps).toBe(0);
  }
 });
 it('does not restart an already active session',()=>{
  expect(transition(running(),{type:'start',now:START+1}).startTime).toBe(START);
 });
});
describe('timestamp timing and expiry',()=>{
 it('expires at exactly 20 minutes, rejecting a tap at the deadline',()=>{
  const before=event(running(),'round',END-1);
  expect(before.completedRoundTimestamps).toEqual([1_199_999]);
  const end=event(before,'round',END);
  expect(end.status).toBe('completed');expect(end.completionStatus).toBe('expired');
  expect(end.completedRoundTimestamps).toHaveLength(1);
  expect(end.elapsedDurationMs).toBe(1_200_000);expect(end.endTime).toBe(END);
  expect(validateSession(end)).toEqual(end);
 });
 it('resolves a background suspension across preparation AND expiry',()=>{
  const s=advance(prep(),END+86_400_000);
  expect(s.startTime).toBe(START);expect(s.endTime).toBe(END);
  expect(s.status).toBe('completed');expect(s.elapsedDurationMs).toBe(1_200_000);
 });
 it('resolves delayed preparation without shifting the workout start',()=>{
  expect(advance(prep(),START+23_456).elapsedDurationMs).toBe(23_456);
 });
 it('clamps backwards timestamps and ignores nonfinite events',()=>{
  const s=advance(running(),START+1000);
  expect(advance(s,START-100).elapsedDurationMs).toBe(1000);
  expect(transition(s,{type:'tick',now:NaN})).toEqual(s);
 });
 it('makes terminal sessions immutable except results',()=>{
  const done=advance(running(),END);
  for(const type of ['round','undo','pause','resume','finish','start','tick'] as const) {
   expect(transition(done,{type,now:END+5000})).toEqual(done);
  }
 });
});
describe('round input',()=>{
 it('counts exactly 30 reps and elapsed timestamp per accepted round',()=>{
  let s=running();
  for(const ms of [1000,25_000,48_000]) s=event(s,'round',START+ms);
  expect(s.completedRoundTimestamps).toEqual([1000,25_000,48_000]);expect(s.totalReps).toBe(90);
  expect(validateSession(s)).toEqual(s);
 });
 it('rejects rapid double taps including identical timestamps',()=>{
  let s=event(running(),'round',START+1000);
  s=event(s,'round',START+1000);s=event(s,'round',START+1599);
  expect(s.totalReps).toBe(30);
  s=event(s,'round',START+1000+ROUND_TAP_GUARD_MS);
  expect(s.totalReps).toBe(60);
 });
 it('undo removes only the last round and keeps rapid-tap protection',()=>{
  let s=event(running(),'round',START+1000);
  s=event(s,'round',START+3000);s=event(s,'undo',START+3010);
  expect(s.completedRoundTimestamps).toEqual([1000]);expect(s.totalReps).toBe(30);
  expect(event(s,'round',START+3020).totalReps).toBe(30);
  s=event(s,'undo',START+4000);s=event(s,'undo',START+5000);
  expect(s.totalReps).toBe(0);expect(s.completedRoundTimestamps).toEqual([]);
 });
});
describe('pause, resume and finish',()=>{
 it('excludes multiple pauses and uses elapsed timestamps for rounds',()=>{
  let s=event(running(),'pause',START+1000);
  expect(event(s,'round',START+2000).totalReps).toBe(0);
  expect(elapsedTime(advance(s,START+999_000),START+999_000)).toBe(1000);
  s=event(s,'resume',START+6000);s=event(s,'round',START+7000);
  expect(s.completedRoundTimestamps).toEqual([2000]);
  s=event(s,'pause',START+8000);s=event(s,'resume',START+10_000);
  expect(s.pauseDurations).toEqual([{startedAt:START+1000,endedAt:START+6000},{startedAt:START+8000,endedAt:START+10_000}]);
  expect(advance(s,END+6999).status).toBe('running');
  expect(advance(s,END+7000).endTime).toBe(END+7000);
  expect(validateSession(s)).toEqual(s);
 });
 it('does not double-apply repeated pause/resume events',()=>{
  let s=event(running(),'pause',START+1000);s=event(s,'pause',START+2000);
  expect(s.pausedAt).toBe(START+1000);
  s=event(s,'resume',START+5000);s=event(s,'resume',START+6000);
  expect(s.pauseDurations).toHaveLength(1);expect(s.elapsedDurationMs).toBe(2000);
 });
 it('does not expire while paused, even beyond the original deadline',()=>{
  const s=advance(event(running(),'pause',START+1000),END+50_000);
  expect(s.status).toBe('paused');expect(s.elapsedDurationMs).toBe(1000);
  expect(validateSession(s)).toEqual(s);
 });
 it('allows undo while paused',()=>{
  const s=event(event(event(running(),'round',START+1000),'pause',START+2000),'undo',START+3000);
  expect(s.totalReps).toBe(0);expect(s.status).toBe('paused');
 });
 it('finishes early from running',()=>{
  const s=event(running(),'finish',START+12345);
  expect(s.completionStatus).toBe('finished');expect(s.elapsedDurationMs).toBe(12345);
  expect(validateSession(s)).toEqual(s);
 });
 it('closes the open pause when finishing and excludes its full duration',()=>{
  const s=event(event(running(),'pause',START+1000),'finish',END+50_000);
  expect(s.elapsedDurationMs).toBe(1000);expect(s.pausedAt).toBeNull();
  expect(s.pauseDurations[0].endedAt).toBe(END+50_000);expect(validateSession(s)).toEqual(s);
 });
 it('resolves expiry before a late pause or manual finish',()=>{
  expect(event(running(),'pause',END).completionStatus).toBe('expired');
  expect(event(running(),'finish',END+1).completionStatus).toBe('expired');
 });
});
describe('results and scoring',()=>{
 it.each([0,1,15,29])('accepts %i partial reps and calculates score',partial=>{
  const done=event(event(running(),'round',START+1000),'finish',START+2000);
  const s=transition(done,{type:'results',now:START+3000,partialReps:partial,perceivedEffort:8,notes:'Strong finish'});
  expect(s.totalReps).toBe(30+partial);expect(validateSession(s)).toEqual(s);
 });
 it.each([-1,31,1.5,NaN,Infinity])('rejects invalid partial value %s',partial=>{
  expect(()=>score(2,partial)).toThrow(RangeError);
  expect(()=>transition(event(running(),'finish',START+1000),{type:'results',now:START+2000,partialReps:partial})).toThrow(RangeError);
 });
 it('does not accept results edits while active',()=>{
  expect(transition(running(),{type:'results',now:START+1000,partialReps:29}).partialReps).toBe(0);
 });
 it('validates optional effort and bounds notes',()=>{
  const s=event(running(),'finish',START+1000);
  expect(()=>transition(s,{type:'results',now:START+1000,perceivedEffort:11})).toThrow();
  expect(transition(s,{type:'results',now:START+1000,notes:'a'.repeat(2100)}).notes).toHaveLength(2000);
 });
 it('rejects negative/fractional full rounds',()=>{
  expect(()=>score(-1,0)).toThrow();expect(()=>score(1.1,0)).toThrow();
 });
 it('formats the countdown without showing zero before the deadline',()=>{
  expect(formatDuration(1)).toBe('0:01');expect(formatDuration(1_200_000)).toBe('20:00');expect(formatDuration(0)).toBe('0:00');
 });
});
describe('recovery and configuration identity',()=>{
 it('recovers preparing, running, paused and completed snapshots',()=>{
  for(const original of [prep(),event(running(),'round',START+1000),event(running(),'pause',START+2000),advance(running(),END)]) {
   const recovered=validateSession(JSON.parse(JSON.stringify(original)));
   const next=advance(recovered,END+10000);
   expect(next.status).toBe(original.status==='paused'?'paused':'completed');
   expect(validateSession(next)).toEqual(next);
  }
 });
 it('retains the double-tap guard across recovery',()=>{
  const restored=validateSession(JSON.parse(JSON.stringify(event(running(),'round',START+1000))));
  expect(event(restored,'round',START+1100).totalReps).toBe(30);
 });
 it('isolates custom duration/identity/movement ordering from standard records',()=>{
  for(const c of [{...STANDARD_CINDY,durationMs:30000},{...STANDARD_CINDY,id:'custom'}]) expect(configurationKey(c)).not.toBe(configurationKey(STANDARD_CINDY));
  expect(configurationKey(structuredClone(STANDARD_CINDY))).toBe(configurationKey(STANDARD_CINDY));
 });
 it('exposes the 30-second configuration only in development',()=>{
  vi.stubEnv('NODE_ENV','production');expect(()=>developmentConfiguration()).toThrow();
  vi.stubEnv('NODE_ENV','development');expect(developmentConfiguration().durationMs).toBe(30000);
  expect(configurationKey(developmentConfiguration())).not.toBe(configurationKey(STANDARD_CINDY));
  vi.unstubAllEnvs();
 });
 it.each([
  {schemaVersion:2},{totalReps:999},{completedRoundTimestamps:[-1]},
  {completedRoundTimestamps:[1_200_000]}, {completedRoundTimestamps:[2000,1000]},
  {startTime:START+1},{pauseDurations:[{startedAt:START+2000,endedAt:START+1000}]},
  {status:'paused',pausedAt:null},{partialReps:30},{perceivedEffort:11},
 ])('rejects malformed persisted data %j',patch=>{
  expect(()=>validateSession({...event(running(),'round',START+1000),...patch})).toThrow();
 });
});

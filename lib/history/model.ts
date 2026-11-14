import {isCustomEmom,validConfiguration,canonicalConfiguration} from '../workout/custom-config';
import {validateCustom,type CustomInterval} from '../workout/custom-emom';
import {validateChelsea,type ChelseaMinute,type ChelseaScore} from '../workout/chelsea';
import { configurationKey, score, STANDARD_CINDY, type PauseDuration, type WorkoutConfiguration, type WorkoutSession } from '../workout/engine';
import { breakdown, partialTotal, type ExerciseBreakdown } from '../workout/partials';
import { validateSession } from '../workout/validation';
export interface SavedWorkout {
  customIntervals?:CustomInterval[];
  chelseaMinutes?:ChelseaMinute[];
  chelseaScore?:ChelseaScore;
  schemaVersion: 1;
  id: string;
  status: 'saved';
  date: string;
  configuration: WorkoutConfiguration;
  startTime: number;
  endTime: number;
  elapsedDurationMs: number;
  completionStatus: 'expired' | 'finished';
  pauseDurations: PauseDuration[];
  completedRounds: number;
  exerciseBreakdown?: ExerciseBreakdown;
  partialReps: number;
  totalReps: number;
  /** Null means that this round's elapsed timestamp is unavailable. */
  completedRoundTimestamps: (number | null)[];
  notes: string;
  perceivedEffort: number | null;
  savedAt: number;
  notesUpdatedAt: number;
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 8.64e15;
export function validateSavedWorkout(value: unknown): SavedWorkout {
  if (!value || typeof value !== 'object') throw new Error('Record must be an object.');
  const s = value as SavedWorkout;
  const c = s.configuration;
  const notes = s.notes === undefined ? '' : s.notes;
  const effort = s.perceivedEffort === undefined ? null : s.perceivedEffort;
  if (s.schemaVersion !== 1 || typeof s.id !== 'string' || !s.id || s.id.length > 200 ||
    !['saved','completed'].includes(s.status) || typeof s.date !== 'string' || !finite(Date.parse(s.date)) ||
    !validConfiguration(c) ||
    !finite(s.startTime) || s.startTime < Date.parse(s.date) + c.preparationMs ||
    !finite(s.endTime) || s.endTime < s.startTime || !finite(s.elapsedDurationMs) || s.elapsedDurationMs > c.durationMs ||
    !['expired','finished'].includes(s.completionStatus) || (s.completionStatus === 'expired' && s.elapsedDurationMs !== c.durationMs) ||
    !Number.isInteger(s.completedRounds) || s.completedRounds < 0 || s.completedRounds > 100_000 ||
    !Number.isInteger(s.partialReps) || s.partialReps < 0 || s.partialReps > 29 || s.totalReps !== (isCustomEmom(c)?s.completedRounds*c.repsPerRound:score(s.completedRounds,s.partialReps)) ||
    !Array.isArray(s.pauseDurations) || s.pauseDurations.length > 100_000 ||
    typeof notes !== 'string' || notes.length > 2000 ||
    (effort !== null && (!Number.isInteger(effort) || effort < 1 || effort > 10)) ||
    !finite(s.savedAt) || !finite(s.notesUpdatedAt) || s.notesUpdatedAt < s.savedAt) throw new Error('Invalid record schema, configuration or score.');
  if(s.exerciseBreakdown!==undefined&&partialTotal(s.exerciseBreakdown)!==s.partialReps)throw new Error('Exercise breakdown does not match score.');
  let pauseEnd = s.startTime;
  let pausedMs = 0;
  for (const p of s.pauseDurations) {
    if (!p || !finite(p.startedAt) || !finite(p.endedAt) || p.startedAt < pauseEnd || p.endedAt < p.startedAt || p.endedAt > s.endTime) throw new Error('Invalid pause timestamps.');
    pauseEnd = p.endedAt; pausedMs += p.endedAt - p.startedAt;
  }
  if (s.endTime - s.startTime - pausedMs !== s.elapsedDurationMs) throw new Error('Elapsed duration does not match timestamps.');
  const times = s.completedRoundTimestamps === undefined ? Array<null>(s.completedRounds).fill(null) : s.completedRoundTimestamps;
  if (!Array.isArray(times) || times.length !== s.completedRounds) throw new Error('Round count and timestamp count do not match.');
  let previous = -1;
  for (const time of times) {
    if (time === null) continue;
    if (!finite(time) || time < previous || time >= c.durationMs || time > s.elapsedDurationMs) throw new Error('Invalid round timestamps.');
    previous = time;
  }
  validateCustom({...s,completedRoundTimestamps:times});
  validateChelsea({...s,completedRoundTimestamps:times});
  // Canonical construction excludes unexpected import fields and stabilizes duplicate comparisons.
  return {
    ...(s.customIntervals?{customIntervals:structuredClone(s.customIntervals)}:{}),
    ...(s.chelseaMinutes?{chelseaMinutes:structuredClone(s.chelseaMinutes)}:{}),
    ...(s.chelseaScore?{chelseaScore:structuredClone(s.chelseaScore)}:{}),
    schemaVersion:1, id:s.id, status:'saved', date:new Date(s.date).toISOString(),
    configuration:canonicalConfiguration(c),
    startTime:s.startTime,endTime:s.endTime,elapsedDurationMs:s.elapsedDurationMs,completionStatus:s.completionStatus,
    pauseDurations:s.pauseDurations.map(p=>({...p})),completedRounds:s.completedRounds,partialReps:s.partialReps,totalReps:s.totalReps,
    completedRoundTimestamps:[...times],...(isCustomEmom(c)?{}:{exerciseBreakdown:breakdown(s.partialReps)}),notes,perceivedEffort:effort,savedAt:s.savedAt,notesUpdatedAt:s.notesUpdatedAt,
  };
}
export function recordFromSession(value: WorkoutSession, now=Date.now()): SavedWorkout {
  const s = validateSession(value);
  if (s.status !== 'completed' && s.status !== 'saved') throw new Error('Finish the workout before saving.');
  return validateSavedWorkout({...s,status:'saved',completedRounds:s.completedRoundTimestamps.length+(s.additionalCompletedRounds??0),completedRoundTimestamps:[...s.completedRoundTimestamps,...Array(s.additionalCompletedRounds??0).fill(null)],savedAt:now,notesUpdatedAt:now});
}
export function configurationLabel(c: WorkoutConfiguration): string {
  if(isCustomEmom(c))return `Custom EMOM · ${c.durationMs/60000} min · ${c.training!.intervalMs/1000}s`;
  if(c.id==='chelsea-standard-v2')return 'Chelsea · EMOM → AMRAP';
  if(c.id==='chelsea-standard-v1')return 'Chelsea · Legacy EMOM';
  if(c.id.startsWith('chelsea-'))return 'Chelsea · Scaled/custom';
  if (configurationKey(c) === configurationKey(STANDARD_CINDY)) return 'Standard Cindy';
  return c.id === 'cindy-development-30s-v1' ? 'Development test · 30 sec' : `Custom Cindy · ${c.durationMs / 60_000} min cap`;
}
export const formatSessionDate = (date:string) => new Date(date).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
export const scoreLabel = (r:SavedWorkout) => isCustomEmom(r.configuration)?`${r.completedRounds} of ${r.customIntervals!.length} intervals · ${r.totalReps} recorded reps`:`${r.completedRounds} rounds + ${r.partialReps} reps · ${r.totalReps} total reps`;

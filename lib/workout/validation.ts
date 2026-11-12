import {validateChelsea} from './chelsea';
import { elapsedTime, score, type WorkoutSession } from './engine';
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const nullableTime = (n: unknown) => n === null || finite(n);
/** Validate persisted state before allowing it to drive the engine. Never silently discard bad data. */
export function validateSession(value: unknown): WorkoutSession {
  if (!value || typeof value !== 'object') throw new Error('Invalid session data.');
  const s = value as WorkoutSession;
  const c = s.configuration;
  if (s.schemaVersion !== 1 || typeof s.id !== 'string' || !s.id || s.id.length > 200 ||
      !finite(s.createdAt) || s.createdAt > 8.64e15 || s.date !== new Date(s.createdAt).toISOString() ||
      !finite(s.lastObservedAt) || s.lastObservedAt < s.createdAt ||
      !['idle','preparing','running','paused','completed','saved'].includes(s.status) ||
      !['active','expired','finished'].includes(s.completionStatus) ||
      !c || typeof c.id !== 'string' || !c.id || !finite(c.durationMs) || c.durationMs < 1000 || c.durationMs > 86_400_000 ||
      c.preparationMs !== 5000 || c.repsPerRound !== 30 ||
      !Array.isArray(c.movements) || c.movements.length !== 3 ||
      !c.movements.every((m,i) => m && m.name === ['pull-ups','push-ups','air-squats'][i] && m.reps === [5,10,15][i]) ||
      !nullableTime(s.preparationStartedAt) || !nullableTime(s.startTime) || !nullableTime(s.endTime) ||
      !nullableTime(s.pausedAt) || !nullableTime(s.lastRoundTapAt) ||
      !finite(s.elapsedDurationMs) || s.elapsedDurationMs > c.durationMs ||
      !Array.isArray(s.pauseDurations) || !Array.isArray(s.completedRoundTimestamps) ||
      s.pauseDurations.length > 100_000 || s.completedRoundTimestamps.length > 100_000 ||
      !Number.isInteger(s.partialReps) || s.partialReps < 0 || s.partialReps > 29 ||
      ![0,1].includes(s.additionalCompletedRounds??0) || s.totalReps !== score(s.completedRoundTimestamps.length+(s.additionalCompletedRounds??0), s.partialReps) ||
      (s.perceivedEffort !== null && (!Number.isInteger(s.perceivedEffort) || s.perceivedEffort < 1 || s.perceivedEffort > 10)) ||
      typeof s.notes !== 'string' || s.notes.length > 2000) throw new Error('Invalid session schema.');
  const terminal = s.status === 'completed' || s.status === 'saved';
  if (terminal !== (s.completionStatus !== 'active') || terminal !== (s.endTime !== null) ||
      (s.status === 'paused') !== (s.pausedAt !== null)) throw new Error('Invalid session lifecycle.');
  if (s.status === 'idle') {
    if (s.preparationStartedAt !== null || s.startTime !== null) throw new Error('Invalid idle session.');
  } else if (s.preparationStartedAt === null || s.preparationStartedAt < s.createdAt || s.preparationStartedAt > s.lastObservedAt) {
    throw new Error('Invalid preparation time.');
  }
  if (s.status === 'preparing' && s.startTime !== null) throw new Error('Preparation has not finished.');
  if (!['idle','preparing'].includes(s.status) && (s.startTime !== s.preparationStartedAt! + 5000 || s.startTime! > s.lastObservedAt)) throw new Error('Invalid start time.');
  let pauseEnd = s.startTime ?? s.createdAt;
  for (const p of s.pauseDurations) {
    if (!p || !finite(p.startedAt) || !finite(p.endedAt) || p.startedAt < pauseEnd || p.endedAt < p.startedAt || p.endedAt > s.lastObservedAt) throw new Error('Invalid pauses.');
    pauseEnd = p.endedAt;
  }
  if (s.pausedAt !== null && (s.pausedAt < pauseEnd || s.pausedAt > s.lastObservedAt)) throw new Error('Invalid open pause.');
  if (s.startTime === null && (s.pauseDurations.length || s.pausedAt !== null || s.elapsedDurationMs !== 0)) throw new Error('Unexpected timing before start.');
  if (s.endTime !== null && (s.endTime < pauseEnd || s.endTime > s.lastObservedAt)) throw new Error('Invalid finish time.');
  const pauseTotal = s.pauseDurations.reduce((sum,p)=>sum + p.endedAt - p.startedAt,0);
  if (terminal && (s.endTime! - s.startTime! - pauseTotal !== s.elapsedDurationMs ||
      (s.completionStatus === 'expired' && s.elapsedDurationMs !== c.durationMs))) throw new Error('Invalid completed duration.');
  if (!terminal && s.elapsedDurationMs !== elapsedTime(s,s.lastObservedAt)) throw new Error('Invalid active duration.');
  let previous = -1;
  for (const t of s.completedRoundTimestamps) {
    if (!finite(t) || t < previous || t >= c.durationMs || t > s.elapsedDurationMs) throw new Error('Invalid round timestamp.');
    previous = t;
  }
  if ((s.completedRoundTimestamps.length > 0 && s.lastRoundTapAt === null) ||
      (s.lastRoundTapAt !== null && (s.startTime === null || s.lastRoundTapAt < s.startTime || s.lastRoundTapAt > s.lastObservedAt)) ||
      (!terminal && s.partialReps !== 0)) throw new Error('Invalid round data.');
  validateChelsea(s);
  return structuredClone(s);
}

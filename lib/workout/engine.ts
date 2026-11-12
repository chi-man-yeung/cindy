/** Pure workout state machine. All times are milliseconds; no timer depends on tick counts. */
export type WorkoutStatus = 'idle' | 'preparing' | 'running' | 'paused' | 'completed' | 'saved';
export interface WorkoutConfiguration {
  id: string;
  durationMs: number;
  preparationMs: 5000;
  movements: readonly [
    { name: 'pull-ups'; reps: 5 },
    { name: 'push-ups'; reps: 10 },
    { name: 'air-squats'; reps: 15 },
  ];
  repsPerRound: 30;
}
export const STANDARD_CINDY: WorkoutConfiguration = {
  id: 'cindy-standard-v1', durationMs: 20 * 60 * 1000, preparationMs: 5000,
  movements: [{ name: 'pull-ups', reps: 5 }, { name: 'push-ups', reps: 10 }, { name: 'air-squats', reps: 15 }],
  repsPerRound: 30,
};
export const ROUND_TAP_GUARD_MS = 600;
export function developmentConfiguration(): WorkoutConfiguration {
  if (process.env.NODE_ENV !== 'development') throw new Error('Test mode is development-only.');
  return { ...STANDARD_CINDY, id: 'cindy-development-30s-v1', durationMs: 30_000 };
}
export interface PauseDuration { startedAt: number; endedAt: number }
/** Stable IDs/configuration are also the foundation for Phase 3 history/import/deletion. */
export interface WorkoutSession {
  schemaVersion: 1;
  id: string;
  date: string;
  configuration: WorkoutConfiguration;
  status: WorkoutStatus;
  completionStatus: 'active' | 'expired' | 'finished';
  createdAt: number;
  preparationStartedAt: number | null;
  startTime: number | null;
  endTime: number | null;
  lastObservedAt: number;
  elapsedDurationMs: number;
  pauseDurations: PauseDuration[];
  pausedAt: number | null;
  completedRoundTimestamps: number[];
  lastRoundTapAt: number | null;
  additionalCompletedRounds?: number;
  partialReps: number;
  totalReps: number;
  perceivedEffort: number | null;
  notes: string;
}
export type WorkoutEvent =
  | { type: 'start' | 'tick' | 'round' | 'undo' | 'pause' | 'resume' | 'finish'; now: number }
  | { type: 'results'; now: number; partialReps?: number; perceivedEffort?: number | null; notes?: string };
export function score(fullRounds: number, partialReps: number): number {
  if (!Number.isInteger(fullRounds) || fullRounds < 0 || !Number.isInteger(partialReps) || partialReps < 0 || partialReps > 29) {
    throw new RangeError('Score requires nonnegative full rounds and 0–29 partial reps.');
  }
  return fullRounds * 30 + partialReps;
}
export function createWorkout(id: string, now: number, configuration = STANDARD_CINDY): WorkoutSession {
  if (!id || !Number.isFinite(now) || now < 0) throw new Error('Invalid workout identity or time.');
  return {
    schemaVersion: 1, id, date: new Date(now).toISOString(), configuration: structuredClone(configuration),
    status: 'idle', completionStatus: 'active', createdAt: now, preparationStartedAt: null,
    startTime: null, endTime: null, lastObservedAt: now, elapsedDurationMs: 0,
    pauseDurations: [], pausedAt: null, completedRoundTimestamps: [], lastRoundTapAt: null,
    partialReps: 0, totalReps: 0, perceivedEffort: null, notes: '',
  };
}
function pausedDuration(session: WorkoutSession): number {
  return session.pauseDurations.reduce((total, pause) => total + pause.endedAt - pause.startedAt, 0);
}
export function elapsedTime(session: WorkoutSession, now: number): number {
  if (session.startTime === null) return 0;
  if (session.status === 'completed' || session.status === 'saved') return session.elapsedDurationMs;
  const until = session.pausedAt ?? Math.max(now, session.lastObservedAt);
  return Math.max(0, Math.min(session.configuration.durationMs, until - session.startTime - pausedDuration(session)));
}
export function advance(session: WorkoutSession, timestamp: number): WorkoutSession {
  if (!Number.isFinite(timestamp) || session.status === 'idle' || session.status === 'completed' || session.status === 'saved') return session;
  const now = Math.max(timestamp, session.lastObservedAt);
  let next = { ...session, lastObservedAt: now };
  if (next.status === 'preparing' && now >= next.preparationStartedAt! + next.configuration.preparationMs) {
    next = { ...next, status: 'running', startTime: next.preparationStartedAt! + next.configuration.preparationMs };
  }
  if (next.status === 'running') {
    next.elapsedDurationMs = elapsedTime(next, now);
    if (next.elapsedDurationMs >= next.configuration.durationMs) {
      next = { ...next, status: 'completed', completionStatus: 'expired',
        endTime: next.startTime! + pausedDuration(next) + next.configuration.durationMs };
    }
  }
  return next;
}
export function transition(session: WorkoutSession, event: WorkoutEvent): WorkoutSession {
  if (!Number.isFinite(event.now)) return session;
  let next = advance(session, event.now);
  const now = Math.max(event.now, next.lastObservedAt);
  switch (event.type) {
    case 'start':
      return next.status === 'idle' ? { ...next, status: 'preparing', preparationStartedAt: now, lastObservedAt: now } : next;
    case 'round': {
      if (next.status !== 'running' || (next.lastRoundTapAt !== null && now - next.lastRoundTapAt < ROUND_TAP_GUARD_MS)) return next;
      const timestamps = [...next.completedRoundTimestamps, elapsedTime(next, now)];
      return { ...next, completedRoundTimestamps: timestamps, lastRoundTapAt: now, totalReps: score(timestamps.length, 0) };
    }
    case 'undo': {
      if (next.status !== 'running' && next.status !== 'paused') return next;
      const timestamps = next.completedRoundTimestamps.slice(0, -1);
      return { ...next, completedRoundTimestamps: timestamps, totalReps: score(timestamps.length, 0) };
    }
    case 'pause':
      return next.status === 'running' ? { ...next, status: 'paused', pausedAt: now } : next;
    case 'resume':
      return next.status === 'paused' ? { ...next, status: 'running', pausedAt: null,
        pauseDurations: [...next.pauseDurations, { startedAt: next.pausedAt!, endedAt: now }] } : next;
    case 'finish':
      if (next.status !== 'running' && next.status !== 'paused') return next;
      next = { ...next, elapsedDurationMs: elapsedTime(next, now), status: 'completed', completionStatus: 'finished', endTime: now,
        pauseDurations: next.pausedAt === null ? next.pauseDurations : [...next.pauseDurations, { startedAt: next.pausedAt, endedAt: now }], pausedAt: null };
      return next;
    case 'results': {
      if (next.status !== 'completed') return next;
      const partial = event.partialReps ?? next.partialReps;
      const extra = partial===30 ? 1 : 0;
      const normalized = partial===30 ? 0 : partial;
      score(next.completedRoundTimestamps.length, normalized);
      const effort = event.perceivedEffort === undefined ? next.perceivedEffort : event.perceivedEffort;
      if (effort !== null && (!Number.isInteger(effort) || effort < 1 || effort > 10)) throw new RangeError('Effort must be 1–10.');
      return { ...next, additionalCompletedRounds: event.partialReps===undefined ? (next.additionalCompletedRounds??0) : extra, partialReps: normalized, totalReps: score(next.completedRoundTimestamps.length+(event.partialReps===undefined?(next.additionalCompletedRounds??0):extra), normalized),
        perceivedEffort: effort, notes: (event.notes ?? next.notes).slice(0, 2000) };
    }
    default: return next;
  }
}
export function preparationCue(session: WorkoutSession, now: number): string | null {
  if (session.status === 'preparing') {
    return String(Math.max(1, Math.min(5, Math.ceil((session.preparationStartedAt! + 5000 - Math.max(now, session.lastObservedAt)) / 1000))));
  }
  if (session.status === 'running' && now - session.startTime! < 800 && session.pauseDurations.length === 0) return 'GO';
  return null;
}
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
/** Configuration identity is structural: test/custom duration can never match standard PBs. */
export function configurationKey(config: WorkoutConfiguration): string {
  return JSON.stringify([config.id, config.durationMs, config.preparationMs, config.repsPerRound, config.movements.map(m => [m.name, m.reps])]);
}
// Planned Phase 3 transport contract. Import will validate each session, skip existing IDs,
// and report conflicting IDs without overwriting records; no import UI is enabled in Phase 2.
export interface WorkoutHistoryExport { schemaVersion: 1; exportedAt: string; sessions: WorkoutSession[] }

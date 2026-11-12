'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { advance, createWorkout, developmentConfiguration, preparationCue, STANDARD_CINDY, transition, type WorkoutEvent, type WorkoutSession } from './engine';
import { loadActiveSession, persistActiveSession } from './storage';
import { WorkoutSounds } from './sounds';
import { saveCompletedWorkout } from '../history/repository';

export function useWorkout() {
  const [session,setSession] = useState<WorkoutSession | null>(null);
  const current = useRef<WorkoutSession | null>(null);
  const [ready,setReady] = useState(false);
  const [storageError,setStorageError] = useState('');
  const [retaining,setRetaining] = useState(false);
  const [soundsEnabled,setSoundsEnabled] = useState(false);
  const [testMode,setTestMode] = useState(false);
  const sounds = useRef<WorkoutSounds | null>(null);
  const queue = useRef(Promise.resolve());
  const writeVersion = useRef(0);
  const [historySaving,setHistorySaving] = useState(false);
  const historySave = useRef<ReturnType<typeof saveCompletedWorkout> | null>(null);
  const save = useCallback((next: WorkoutSession | null) => {
    const version = ++writeVersion.current;
    setRetaining(true);
    queue.current = queue.current.then(() => persistActiveSession(next)).then(() => {
      if (version === writeVersion.current) { setRetaining(false); setStorageError(''); }
    }).catch(() => {
      if (version === writeVersion.current) {
        setRetaining(false);
        setStorageError('Local storage failed. This workout is still running, but the latest changes may not survive a refresh.');
      }
    });
  },[]);
  const dispatch = useCallback((event: WorkoutEvent) => {
    if (!current.current || current.current.status === 'saved' || historySave.current) return;
    // Synchronous ref update closes the gap between rapid events before React rerenders.
    const next = transition(current.current,event);
    current.current = next;
    setSession(next);
    save(next);
  },[save]);
  useEffect(() => {
    let cancelled = false;
    void loadActiveSession().then(stored => {
      if (cancelled) return;
      if (stored?.configuration.id === 'cindy-development-30s-v1' && !['completed','saved'].includes(stored.status) && process.env.NODE_ENV !== 'development') {
        setStorageError('A development test session was found. Open the development app to finish it; test mode is unavailable in production.');
        return;
      }
      const recovered = stored ? advance(stored,Date.now()) : null;
      current.current = recovered;
      setSession(recovered);
      setReady(true);
      if (recovered && recovered.status !== stored?.status) save(recovered);
    }).catch(() => {
      if (!cancelled) setStorageError('Unable to recover local workout data. Check browser storage and reload. Existing data has not been deleted.');
    });
    return () => { cancelled = true; };
  },[save]);
  useEffect(() => {
    function refresh() {
      const previous = current.current;
      if (!previous || !['preparing','running','paused'].includes(previous.status)) return;
      const next = advance(previous,Date.now());
      current.current = next;
      if (next.status !== 'paused' || previous.status !== 'paused') setSession(next);
      // Timing is derived from timestamps. Persist transitions, not every visual refresh.
      if (next.status !== previous.status) save(next);
    }
    const interval = window.setInterval(refresh,100);
    window.addEventListener('pageshow',refresh);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pageshow',refresh);
      window.removeEventListener('focus',refresh);
      document.removeEventListener('visibilitychange',refresh);
    };
  },[save]);
  const cue = session ? preparationCue(session,session.lastObservedAt) : null;
  const previousCue = useRef<string | null>(null);
  const previousStatus = useRef(session?.status);
  useEffect(() => {
    if (soundsEnabled && cue && previousCue.current !== cue) sounds.current?.cue(cue);
    if (soundsEnabled && session?.status === 'completed' && previousStatus.current && previousStatus.current !== 'completed') sounds.current?.cue('complete');
    previousCue.current = cue;
    previousStatus.current = session?.status;
  },[cue,session?.status,soundsEnabled]);
  useEffect(() => () => { sounds.current?.close(); sounds.current = null; },[]);
  const start = useCallback(() => {
    if (!ready || historySave.current || (current.current && ['preparing','running','paused'].includes(current.current.status))) return;
    if (soundsEnabled) {
      sounds.current ??= new WorkoutSounds();
      // Called in a user gesture so Safari can grant foreground audio playback.
      void sounds.current.unlock();
    }
    const now = Date.now();
    const config = process.env.NODE_ENV === 'development' && testMode ? developmentConfiguration() : STANDARD_CINDY;
    const next = transition(createWorkout(crypto.randomUUID(),now,config),{type:'start',now});
    current.current = next;
    setSession(next);
    save(next);
  },[ready,soundsEnabled,testMode,save]);
  const cancelPreparation = useCallback(() => {
    if (current.current?.status !== 'preparing') return;
    const resolved = advance(current.current,Date.now());
    if (resolved.status !== 'preparing') {
      current.current = resolved; setSession(resolved); save(resolved); return;
    }
    current.current = null;
    setSession(null);
    save(null);
  },[save]);
  const saveToHistory = useCallback(() => {
    if (historySave.current) return historySave.current;
    const snapshot = current.current;
    if (!snapshot || !['completed','saved'].includes(snapshot.status)) return Promise.reject(new Error('Finish the workout first.'));
    setHistorySaving(true);
    const task = queue.current.then(()=>saveCompletedWorkout(snapshot)).then(result=>{
      if (current.current?.id === snapshot.id) {
        const saved = { ...snapshot, status:'saved' as const };
        current.current = saved; setSession(saved); setStorageError('');
      }
      return result;
    }).finally(()=>{historySave.current=null;setHistorySaving(false)});
    historySave.current=task;
    return task;
  },[save]);
  const forgetSaved = useCallback((id:string)=>{
    if (current.current?.id===id && ['saved','completed'].includes(current.current.status)) {
      current.current=null;setSession(null);save(null);
    }
  },[save]);
  return { session, ready, storageError, retaining, soundsEnabled, setSoundsEnabled, testMode, setTestMode, cue, start, dispatch, cancelPreparation, saveToHistory, historySaving, forgetSaved };
}

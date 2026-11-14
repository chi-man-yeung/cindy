'use client';
import {listPresets} from '../workout/presets';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SavedWorkout } from './model';
import { deleteWorkout, listSavedWorkouts, mergeBackup, updateWorkoutNotes } from './repository';
import { exportBackup, type ParsedBackup } from './backup';
export function useHistory(){
 const [records,setRecords]=useState<SavedWorkout[]>([]);
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const revision=useRef(0);
 const refresh=useCallback(async()=>{
  const version=++revision.current;
  try{const data=await listSavedWorkouts();if(version===revision.current){setRecords(data);setError('')}}
  catch(error){if(version===revision.current)setError(error instanceof Error?error.message:'Could not load history.')}
  finally{if(version===revision.current)setLoading(false)}
 },[]);
 useEffect(()=>{void refresh();window.addEventListener('focus',refresh);return()=>{revision.current++;window.removeEventListener('focus',refresh)}},[refresh]);
 const remove=async(id:string)=>{await deleteWorkout(id);await refresh()};
 const editNotes=async(id:string,notes:string)=>{await updateWorkoutNotes(id,notes);await refresh()};
 const restore=async(parsed:ParsedBackup)=>{const report=await mergeBackup(parsed);await refresh();return report};
 const backup=async()=>{const [sessions,presets]=await Promise.all([listSavedWorkouts(),listPresets()]);return exportBackup(sessions,Date.now(),presets)};
 return {records,loading,error,refresh,remove,editNotes,restore,backup};
}

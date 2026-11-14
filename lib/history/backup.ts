import {isCustomEmom} from '../workout/custom-config';
import { validateSavedWorkout, type SavedWorkout } from './model';
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export interface HistoryBackup {schemaVersion:1|2;exportedAt:string;sessions:SavedWorkout[]}
export interface ParsedBackup {records:SavedWorkout[];rejected:number;duplicates:number;conflicts:number;issues:string[]}
export interface ImportReport {imported:number;duplicates:number;conflicts:number;deleted:number;rejected:number;issues:string[]}
export function exportBackup(records:readonly SavedWorkout[],now=Date.now()): string {
  const data:HistoryBackup={schemaVersion:records.some(r=>isCustomEmom(r.configuration))?2:1,exportedAt:new Date(now).toISOString(),sessions:records.map(validateSavedWorkout)};
  return JSON.stringify(data,null,2);
}
export function parseBackup(text:string):ParsedBackup {
  if (new TextEncoder().encode(text).length>MAX_BACKUP_BYTES) throw new Error('Backup exceeds the 10 MB limit.');
  let value:unknown;
  try {value=JSON.parse(text)} catch {throw new Error('This file is not valid JSON.');}
  if (!value || typeof value!=='object') throw new Error('Invalid backup envelope.');
  const data=value as HistoryBackup;
  if ((data.schemaVersion!==1&&data.schemaVersion!==2) || typeof data.exportedAt!=='string' || !Number.isFinite(Date.parse(data.exportedAt)) ||
      !Array.isArray(data.sessions) || data.sessions.length>10_000) throw new Error('Expected a version 1 or 2 CINDY backup with at most 10,000 sessions.');
  const records=new Map<string,SavedWorkout>();const issues:string[]=[];
  let rejected=0,duplicates=0,conflicts=0;
  data.sessions.forEach((value,index)=>{
    try {
      const record=validateSavedWorkout(value);
      const previous=records.get(record.id);
      if (!previous) records.set(record.id,record);
      else if (JSON.stringify(previous)===JSON.stringify(record)) duplicates++;
      else {conflicts++;issues.push(`Entry ${index+1}: repeated ID ${record.id}; first valid entry retained.`)}
    } catch(error) {rejected++;issues.push(`Entry ${index+1}: ${error instanceof Error?error.message:'Invalid record.'}`)}
  });
  return {records:[...records.values()],rejected,duplicates,conflicts,issues};
}

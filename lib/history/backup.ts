import {validatePreset,type TrainingPreset} from '../workout/presets';
import {isCustomEmom} from '../workout/custom-config';
import { validateSavedWorkout, type SavedWorkout } from './model';
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export interface HistoryBackup {schemaVersion:1|2|3;exportedAt:string;sessions:SavedWorkout[];presets?:TrainingPreset[]}
export interface PresetReport {imported:number;duplicates:number;conflicts:number;rejected:number}
export interface ParsedBackup {presets:TrainingPreset[];presetReport:PresetReport;records:SavedWorkout[];rejected:number;duplicates:number;conflicts:number;issues:string[]}
export interface ImportReport {presets:PresetReport;imported:number;duplicates:number;conflicts:number;deleted:number;rejected:number;issues:string[]}
export function exportBackup(records:readonly SavedWorkout[],now=Date.now(),presets:readonly TrainingPreset[]=[]): string {
  const data:HistoryBackup={schemaVersion:presets.length?3:records.some(r=>isCustomEmom(r.configuration))?2:1,exportedAt:new Date(now).toISOString(),sessions:records.map(validateSavedWorkout),...(presets.length?{presets:presets.map(validatePreset)}:{})};
  return JSON.stringify(data,null,2);
}
export function parseBackup(text:string):ParsedBackup {
  if (new TextEncoder().encode(text).length>MAX_BACKUP_BYTES) throw new Error('Backup exceeds the 10 MB limit.');
  let value:unknown;
  try {value=JSON.parse(text)} catch {throw new Error('This file is not valid JSON.');}
  if (!value || typeof value!=='object') throw new Error('Invalid backup envelope.');
  const data=value as HistoryBackup;
  if ((data.schemaVersion!==1&&data.schemaVersion!==2&&data.schemaVersion!==3) || typeof data.exportedAt!=='string' || !Number.isFinite(Date.parse(data.exportedAt)) ||
      !Array.isArray(data.sessions) || data.sessions.length>10_000) throw new Error('Expected a version 1, 2 or 3 CINDY backup with at most 10,000 sessions.');
  if ((data.schemaVersion===3&&!Array.isArray(data.presets)) || (data.presets!==undefined&&(!Array.isArray(data.presets)||data.presets.length>10_000))) throw new Error('Expected at most 10,000 presets.');
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
  const presets=new Map<string,TrainingPreset>();const presetReport:PresetReport={imported:0,duplicates:0,conflicts:0,rejected:0};
  (data.presets??[]).forEach((value,index)=>{
    try {
      const preset=validatePreset(value);const previous=presets.get(preset.id);
      if(!previous)presets.set(preset.id,preset);
      else if(JSON.stringify(previous)===JSON.stringify(preset))presetReport.duplicates++;
      else {presetReport.conflicts++;issues.push(`Preset ${index+1}: repeated ID ${preset.id}; first valid preset retained.`)}
    }catch(error){presetReport.rejected++;issues.push(`Preset ${index+1}: ${error instanceof Error?error.message:'Invalid preset.'}`)}
  });
  return {records:[...records.values()],presets:[...presets.values()],presetReport,rejected,duplicates,conflicts,issues};
}

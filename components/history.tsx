'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Dumbbell, Trash2, Trophy, Upload, X } from 'lucide-react';
import { Eyebrow, PrimaryButton, SectionTitle, Stat } from './ui';
import ProgressChart from './progress-chart';
import {isCustomEmom,exerciseLabel} from '@/lib/workout/custom-config';
import {trainingSummary} from '@/lib/workout/custom-emom';
import { breakdown } from '@/lib/workout/partials';
import { analytics, bestByConfiguration, roundSplits } from '@/lib/history/analytics';
import { configurationLabel, formatSessionDate, scoreLabel, type SavedWorkout } from '@/lib/history/model';
import { MAX_BACKUP_BYTES, parseBackup, type ImportReport, type ParsedBackup } from '@/lib/history/backup';
import { configurationKey, formatDuration, STANDARD_CINDY } from '@/lib/workout/engine';
import type { useHistory } from '@/lib/history/use-history';
type HistoryData=ReturnType<typeof useHistory>;
function DeleteDialog({record,busy,error,onCancel,onDelete}:{record:SavedWorkout;busy:boolean;error:string;onCancel:()=>void;onDelete:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{dialog.current?.showModal()},[]);
 return <dialog ref={dialog} className="modal" aria-labelledby="delete-title" onCancel={event=>{event.preventDefault();if(!busy)onCancel()}}>
  <button className="modal-close" aria-label="Close deletion confirmation" disabled={busy} onClick={onCancel}><X size={20}/></button>
  <Trash2 size={24}/><h2 id="delete-title">Delete this workout?</h2>
  <p><strong>{formatSessionDate(record.date)}</strong><br/>{scoreLabel(record)}<br/>{configurationLabel(record.configuration)}</p>
  <p>This permanently removes only this record. Older backups will not restore its deleted ID on this device.</p>
  {error&&<p role="alert">{error}</p>}
  <button className="primary" disabled={busy} onClick={onDelete}>{busy?'DELETING…':'DELETE WORKOUT'}</button>
  <button className="text-button" autoFocus disabled={busy} onClick={onCancel}>Cancel</button>
 </dialog>;
}
function WorkoutDetail({record,onBack,onDeleted,data}:{record:SavedWorkout;onBack:()=>void;onDeleted:(id:string)=>void;data:HistoryData}){
 const heading=useRef<HTMLHeadingElement>(null);
 const [notes,setNotes]=useState(record.notes);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const [deleting,setDeleting]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{heading.current?.focus()},[]);
 const splits=roundSplits(record);
 const custom=isCustomEmom(record.configuration);
 const training=trainingSummary(record);
 const saveNotes=async()=>{
  setBusy(true);setMessage('');setError('');
  try{await data.editNotes(record.id,notes);setMessage('Notes saved on this device.')}
  catch(error){setError(error instanceof Error?error.message:'Notes were not saved.')}
  finally{setBusy(false)}
 };
 const remove=async()=>{
  setBusy(true);setError('');
  try{await data.remove(record.id);onDeleted(record.id);onBack()}
  catch(error){setError(error instanceof Error?error.message:'Deletion failed.');setBusy(false)}
 };
 return <>
  <button className="text-button back-link" disabled={busy} onClick={onBack}><ChevronLeft size={17}/>Back to history</button>
  <section className="sub-heading"><div><Eyebrow>{configurationLabel(record.configuration)}</Eyebrow><h1 ref={heading} tabIndex={-1}>Your session.</h1><p>{formatSessionDate(record.date)}</p></div><span className="pill">SAVED WORKOUT</span></section>
  <div className="results-layout"><section className="panel results-card"><Eyebrow>{custom?"TRAINING SUMMARY":"YOUR SCORE"}</Eyebrow>{record.chelseaScore&&<p className="small muted">{record.chelseaScore.onTimeRounds}/30 on-time · {record.chelseaScore.postTransitionRounds} AMRAP rounds · {record.completedRounds} total rounds · {record.partialReps} partial reps{record.chelseaScore.onTimeRounds===30?' · Full Chelsea completion':''}</p>}<div className="result-score">{record.completedRounds}<span>{custom?`of ${training.planned} intervals`:`rounds + ${record.partialReps} reps`}</span></div>
   <div className="result-stats"><Stat label="TOTAL REPS" value={record.totalReps}/><Stat label="ELAPSED DURATION" value={formatDuration(record.elapsedDurationMs)}/></div>
   <p className="small muted">{record.completionStatus==='expired'?'Time cap reached':'Finished early'} · {formatDuration(record.configuration.durationMs)} cap{record.perceivedEffort!==null?` · Effort ${record.perceivedEffort}/10`:''}</p>
   {custom?<section className="training-summary"><p>{training.completionRate}% completion · {training.missed} missed · {training.incomplete} incomplete · {training.totalVolume} recorded reps</p><p>Each interval: {record.configuration.movements.map(m=>`${m.reps} ${exerciseLabel(m.name)}`).join(" / ")}</p><p>Recorded volume includes fully completed intervals only. No benchmark ranking.</p></section>:<p className="small muted">Partial round: {breakdown(record.partialReps).pullUps} pull-ups · {breakdown(record.partialReps).pushUps} push-ups · {breakdown(record.partialReps).airSquats} squats</p>}{record.chelseaMinutes&&<ol className="round-splits">{record.chelseaMinutes.filter(m=>!record.chelseaScore||record.chelseaScore.transitionElapsedMs===null||m.minute<=record.chelseaScore.transitionElapsedMs/60000).map(m=><li key={m.minute}>Minute {m.minute}<strong>{m.status}</strong></li>)}</ol>}<label className="notes-label" htmlFor="saved-notes">Session notes</label><textarea id="saved-notes" value={notes} maxLength={2000} rows={4} onChange={e=>setNotes(e.target.value)} disabled={busy}/>
   <PrimaryButton disabled={busy||notes===record.notes} onClick={()=>void saveNotes()}>SAVE NOTES</PrimaryButton>
   {message&&<p className="notice" role="status">{message}</p>}{error&&!deleting&&<p role="alert" className="storage-message">{error}</p>}
   <button className="delete-record" disabled={busy} onClick={()=>{setError('');setDeleting(true)}}><Trash2 size={17}/>Delete workout</button>
  </section><aside className="panel">{custom?<><SectionTitle title="Interval record" detail={`${training.completed} / ${training.planned} COMPLETED`}/><ol className="round-splits">{record.customIntervals!.map(i=><li key={i.interval}><span>Interval {i.interval} · {formatDuration(i.startMs)}–{formatDuration(i.endMs)}</span><strong>{i.status}</strong><span>{i.completedAt===null?'No completed volume recorded':`${formatDuration(i.completedAt)} elapsed · ${record.configuration.repsPerRound} reps`}</span></li>)}</ol></>:<><SectionTitle title="Round splits" detail={`${record.completedRounds} ROUNDS`}/>
   {!splits.length?<p className="empty-state">No full rounds were recorded.</p>:<ol className="round-splits">{splits.map(split=><li key={split.round}><span>Round {split.round}</span><strong>{split.durationMs===null?'Unavailable':formatDuration(split.durationMs)}</strong><span>{split.elapsedMs===null?'No timestamp':`${formatDuration(split.elapsedMs)} elapsed`}</span></li>)}</ol>}
   {splits.some(s=>s.durationMs===null)&&<p className="small muted">Missing timestamps are shown as unavailable; split times are never estimated.</p>}</>}
  </aside></div>
  {deleting&&<DeleteDialog record={record} busy={busy} error={error} onCancel={()=>setDeleting(false)} onDelete={()=>void remove()}/>}
 </>;
}
export default function WorkoutHistory({data,onDeleted}:{data:HistoryData;onDeleted:(id:string)=>void}){
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [configKey,setConfigKey]=useState(configurationKey(STANDARD_CINDY));
 const [pending,setPending]=useState<ParsedBackup|null>(null);const [report,setReport]=useState<ImportReport|null>(null);
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const file=useRef<HTMLInputElement>(null);
 const configurations=new Map([[configurationKey(STANDARD_CINDY),STANDARD_CINDY]]);
 for(const record of data.records)configurations.set(configurationKey(record.configuration),record.configuration);
 const configuration=configurations.get(configKey)??STANDARD_CINDY;
 const summary=useMemo(()=>analytics(data.records,configuration),[data.records,configuration]);
 const bests=useMemo(()=>bestByConfiguration(data.records),[data.records]);
 const custom=isCustomEmom(configuration);
 const trainingRecords=data.records.filter(r=>configurationKey(r.configuration)===configurationKey(configuration));
 const planned=trainingRecords.reduce((sum,r)=>sum+(r.customIntervals?.length??0),0);
 const completions=trainingRecords.reduce((sum,r)=>sum+r.completedRounds,0);
 const selected=data.records.find(r=>r.id===selectedId);
 const chooseFile=async(input:HTMLInputElement)=>{
  const upload=input.files?.[0];input.value='';setPending(null);setReport(null);setMessage('');
  if(!upload)return;
  setBusy(true);
  try{if(upload.size>MAX_BACKUP_BYTES)throw new Error('Backup exceeds the 10 MB limit.');setPending(parseBackup(await upload.text()))}
  catch(error){setMessage(error instanceof Error?error.message:'Could not read backup.')}
  finally{setBusy(false)}
 };
 const restore=async()=>{
  if(!pending||busy)return;setBusy(true);setMessage('');
  try{setReport(await data.restore(pending));setPending(null)}
  catch(error){setMessage(error instanceof Error?error.message:'Import failed.')}
  finally{setBusy(false)}
 };
 const download=async()=>{
  setBusy(true);setMessage('');
  try{
   const text=await data.backup();const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
   const anchor=document.createElement('a');anchor.href=url;anchor.download=`cindy-backup-${new Date().toISOString().slice(0,10)}.json`;
   document.body.appendChild(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){setMessage(error instanceof Error?error.message:'Export failed.')}
  finally{setBusy(false)}
 };
 if(selected)return <WorkoutDetail key={selected.id} record={selected} data={data} onBack={()=>setSelectedId(null)} onDeleted={onDeleted}/>;
 return <>
  <section className="sub-heading"><div><Eyebrow>THE WORK ADDS UP</Eyebrow><h1>Your <em>track record.</em></h1><p>Small gains. Stronger standards.</p></div><span className="pill">{data.records.length} SAVED SESSIONS</span></section>
  {data.error&&<p className="storage-message" role="alert">{data.error}</p>}
  <div className="history-filter"><label htmlFor="analytics-configuration">Analytics configuration</label><select id="analytics-configuration" value={configurationKey(configuration)} onChange={e=>setConfigKey(e.target.value)}>{[...configurations].map(([key,c])=><option key={key} value={key}>{configurationLabel(c)}</option>)}</select></div>
  <div className="history-stats history-metrics"><Stat label="SESSIONS" value={summary.count}/><Stat label={custom?"LATEST VOLUME":"LATEST SCORE"} value={summary.latest?.totalReps??'—'} unit="reps"/>{custom?<><Stat label="COMPLETION RATE" value={planned?Math.round(completions/planned*100):0} unit="%"/><Stat label="TOTAL VOLUME" value={trainingRecords.reduce((sum,r)=>sum+r.totalReps,0)} unit="reps"/></>:<><Stat label="PERSONAL BEST" value={summary.best?.chelseaScore?.onTimeRounds??summary.best?.totalReps??'—'} unit={summary.best?.chelseaScore?'on-time rounds':'reps'}/><Stat label="VS PREVIOUS" value={summary.delta===null?'—':`${summary.delta>0?'+':''}${summary.delta}`} unit="reps"/></>}</div>
  <p className="small muted analytics-caption">{custom?'Training only: completion rate is completed intervals / planned intervals. Volume counts completed intervals only. No PB or benchmark ranking.':configuration.id==='chelsea-standard-v2'?'Chelsea PB: consecutive on-time rounds, then total rounds, then partial reps.':'Statistics compare only identical configurations.'} Session history below includes every configuration.</p>
  <section className="panel chart-panel"><SectionTitle title={custom?"Training volume":"Moving the benchmark"} detail={`${configurationLabel(configuration).toUpperCase()} · TOTAL REPS`}/><ProgressChart data={summary.chart}/></section>
  <section className="history-list"><SectionTitle title="Session history" detail="NEWEST FIRST · ALL CONFIGURATIONS"/>
   {data.loading?<p className="empty-state" role="status">Loading your history…</p>:!data.records.length?<div className="panel empty-state"><h3>Your first benchmark is ahead.</h3><p>Finish a workout and select Save workout. Your records and progress will appear here.</p></div>:data.records.map(record=>{
    const best=bests.get(configurationKey(record.configuration))?.id===record.id;
    return <div key={record.id} className="history-item"><button className="history-row" onClick={()=>{setSelectedId(record.id);setMessage('')}} aria-label={`Open ${configurationLabel(record.configuration)}, ${formatSessionDate(record.date)}, ${scoreLabel(record)}`}>
     <span className="session-icon"><Dumbbell size={19}/></span><span className="recent-name"><b>{configurationLabel(record.configuration)}{best&&<Trophy size={14} className="accent" aria-label="Personal best"/>}</b><span>{formatSessionDate(record.date)} · {formatDuration(record.elapsedDurationMs)}</span></span>
     <span className="history-score"><b>{record.completedRounds} <small>{isCustomEmom(record.configuration)?`/ ${record.customIntervals!.length} intervals`:`rounds + ${record.partialReps} reps`}</small></b><span>{record.totalReps} total reps</span></span><ChevronRight size={18}/>
    </button></div>;
   })}
  </section>
  <section className="panel backup-panel"><SectionTitle title="Backup & restore" detail="JSON · LOCAL DATA"/><p className="muted small">Export all saved workouts. Import merges new IDs into your history. Existing and previously deleted IDs are skipped; nothing is replaced. Malformed entries are rejected and reported.</p>
   <div className="backup-actions"><button disabled={busy||data.loading||!!data.error} onClick={()=>void download()}><Download size={17}/>Export JSON</button><button disabled={busy||data.loading||!!data.error} onClick={()=>file.current?.click()}><Upload size={17}/>Import JSON</button><input ref={file} type="file" accept="application/json,.json" aria-label="Import workout backup" onChange={e=>void chooseFile(e.target)} hidden/></div>
   {pending&&<div className="import-preview"><p>{pending.records.length} valid unique records · {pending.rejected} malformed rejected · {pending.duplicates} duplicate entries · {pending.conflicts} conflicting entries.</p><p>Confirm merge? Existing records and deleted IDs will be kept unchanged.</p><button className="primary" disabled={busy||!pending.records.length} onClick={()=>void restore()}>{busy?'IMPORTING…':'CONFIRM IMPORT'}</button><button className="text-button" disabled={busy} onClick={()=>setPending(null)}>Cancel import</button>{pending.issues.length>0&&<details><summary>Validation details</summary><ul>{pending.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></details>}</div>}
   {report&&<div className="import-report" role="status"><p>Imported {report.imported} · Duplicates skipped {report.duplicates} · Conflicts skipped {report.conflicts} · Deleted IDs skipped {report.deleted} · Rejected {report.rejected}</p>{report.issues.length>0&&<details><summary>Import details</summary><ul>{report.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></details>}</div>}
   {message&&<p className="storage-message" role="alert">{message}</p>}
  </section>
 </>;
}

'use client';
import {useLanguage} from '@/components/language';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Dumbbell, Trash2, Trophy, Upload, X } from 'lucide-react';
import { Eyebrow, PrimaryButton, SectionTitle, Stat } from './ui';
import ProgressChart from './progress-chart';
import {isCustomEmom,exerciseLabel} from '@/lib/workout/custom-config';
import {trainingSummary} from '@/lib/workout/custom-emom';
import { breakdown } from '@/lib/workout/partials';
import { analytics, bestByConfiguration, roundSplits } from '@/lib/history/analytics';
import { configurationLabel, scoreLabel, type SavedWorkout } from '@/lib/history/model';
import { MAX_BACKUP_BYTES, parseBackup, type ImportReport, type ParsedBackup } from '@/lib/history/backup';
import { configurationKey, formatDuration, STANDARD_CINDY } from '@/lib/workout/engine';
import type { useHistory } from '@/lib/history/use-history';
type HistoryData=ReturnType<typeof useHistory>;
function DeleteDialog({record,busy,error,onCancel,onDelete}:{record:SavedWorkout;busy:boolean;error:string;onCancel:()=>void;onDelete:()=>void}){
 const {t,date}=useLanguage();
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{dialog.current?.showModal()},[]);
 return <dialog ref={dialog} className="modal" aria-labelledby="delete-title" onCancel={event=>{event.preventDefault();if(!busy)onCancel()}}>
  <button className="modal-close" aria-label={t("Close deletion confirmation")} disabled={busy} onClick={onCancel}><X size={20}/></button>
  <Trash2 size={24}/><h2 id="delete-title">{t("Delete this workout?")}</h2>
  <p><strong>{date(record.date)}</strong><br/>{t(scoreLabel(record))}<br/>{t(configurationLabel(record.configuration))}</p>
  <p>{t("This permanently removes only this record. Older backups will not restore its deleted ID on this device.")}</p>
  {error&&<p role="alert">{t(error)}</p>}
  <button className="primary" disabled={busy} onClick={onDelete}>{busy?t("DELETING…"):t("DELETE WORKOUT")}</button>
  <button className="text-button" autoFocus disabled={busy} onClick={onCancel}>{t("Cancel")}</button>
 </dialog>;
}
function WorkoutDetail({record,onBack,onDeleted,data}:{record:SavedWorkout;onBack:()=>void;onDeleted:(id:string)=>void;data:HistoryData}){
 const {t,date,locale}=useLanguage();
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
  catch(error){setError(error instanceof Error?error.message:"Notes were not saved.")}
  finally{setBusy(false)}
 };
 const remove=async()=>{
  setBusy(true);setError('');
  try{await data.remove(record.id);onDeleted(record.id);onBack()}
  catch(error){setError(error instanceof Error?error.message:"Deletion failed.");setBusy(false)}
 };
 return <>
  <button className="text-button back-link" disabled={busy} onClick={onBack}><ChevronLeft size={17}/>{t("Back to history")}</button>
  <section className="sub-heading"><div><Eyebrow>{t(configurationLabel(record.configuration))}</Eyebrow><h1 ref={heading} tabIndex={-1}>{t("Your session.")}</h1><p>{date(record.date)}</p></div><span className="pill">{t("SAVED WORKOUT")}</span></section>
  <div className="results-layout"><section className="panel results-card"><Eyebrow>{custom?t("TRAINING SUMMARY"):t("YOUR SCORE")}</Eyebrow>{record.chelseaScore&&<p className="small muted">{record.chelseaScore.onTimeRounds}{t("/30 on-time · ")}{record.chelseaScore.postTransitionRounds}{t(" AMRAP rounds · ")}{record.completedRounds}{t(" total rounds · ")}{record.partialReps}{t(" partial reps")}{record.chelseaScore.onTimeRounds===30?t(" · Full Chelsea completion"):''}</p>}<div className="result-score">{record.completedRounds}<span>{custom?t("of {0} intervals",[training.planned]):t("rounds + {0} reps",[record.partialReps])}</span></div>
   <div className="result-stats"><Stat label={t("TOTAL REPS")} value={record.totalReps}/><Stat label={t("ELAPSED DURATION")} value={formatDuration(record.elapsedDurationMs)}/></div>
   <p className="small muted">{record.completionStatus==='expired'?t("Time cap reached"):t("Finished early")} · {formatDuration(record.configuration.durationMs)}{t(" cap")}{record.perceivedEffort!==null?t(" · Effort {0}/10",[record.perceivedEffort]):''}</p>
   {custom?<section className="training-summary"><p>{training.completionRate}{t("% completion · ")}{training.missed}{t(" missed · ")}{training.incomplete}{t(" incomplete · Completed Volume: ")}{training.totalVolume}{t(" reps")}</p><p>{t("Each interval: ")}{record.configuration.movements.map(m=>`${m.reps} ${t(exerciseLabel(m.name))}`).join(" / ")}</p><p>{t("Completed Volume includes only successfully completed intervals. No benchmark ranking.")}</p></section>:<p className="small muted">{t("Partial round: ")}{breakdown(record.partialReps).pullUps}{t(" pull-ups · ")}{breakdown(record.partialReps).pushUps}{t(" push-ups · ")}{breakdown(record.partialReps).airSquats}{t(" squats")}</p>}{record.chelseaMinutes&&<ol className="round-splits">{record.chelseaMinutes.filter(m=>!record.chelseaScore||record.chelseaScore.transitionElapsedMs===null||m.minute<=record.chelseaScore.transitionElapsedMs/60000).map(m=><li key={m.minute}>{t("Minute ")}{m.minute}<strong>{t(m.status)}</strong></li>)}</ol>}<label className="notes-label" htmlFor="saved-notes">{t("Session notes")}</label><textarea id="saved-notes" value={notes} maxLength={2000} rows={4} onChange={e=>setNotes(e.target.value)} disabled={busy}/>
   <PrimaryButton disabled={busy||notes===record.notes} onClick={()=>void saveNotes()}>{t("SAVE NOTES")}</PrimaryButton>
   {message&&<p className="notice" role="status">{t(message)}</p>}{error&&!deleting&&<p role="alert" className="storage-message">{t(error)}</p>}
   <button className="delete-record" disabled={busy} onClick={()=>{setError('');setDeleting(true)}}><Trash2 size={17}/>{t("Delete workout")}</button>
  </section><aside className="panel">{custom?<><SectionTitle title={t("Interval record")} detail={t("{0} / {1} COMPLETED",[training.completed,training.planned])}/><ol className="round-splits">{record.customIntervals!.map(i=><li key={i.interval}><span>{t("Interval ")}{i.interval} · {formatDuration(i.startMs)}–{formatDuration(i.endMs)}</span><strong>{t(i.status)}</strong><span>{i.completedAt===null?t("No completed volume recorded"):t("{0} elapsed · {1} reps",[formatDuration(i.completedAt),record.configuration.repsPerRound])}</span></li>)}</ol></>:<><SectionTitle title={t("Round splits")} detail={t("{0} ROUNDS",[record.completedRounds])}/>
   {!splits.length?<p className="empty-state">{t("No full rounds were recorded.")}</p>:<ol className="round-splits">{splits.map(split=><li key={split.round}><span>{t("Round ")}{split.round}</span><strong>{split.durationMs===null?t("Unavailable"):formatDuration(split.durationMs)}</strong><span>{split.elapsedMs===null?t("No timestamp"):t("{0} elapsed",[formatDuration(split.elapsedMs)])}</span></li>)}</ol>}
   {splits.some(s=>s.durationMs===null)&&<p className="small muted">{t("Missing timestamps are shown as unavailable; split times are never estimated.")}</p>}</>}
  </aside></div>
  {deleting&&<DeleteDialog record={record} busy={busy} error={t(error)} onCancel={()=>setDeleting(false)} onDelete={()=>void remove()}/>}
 </>;
}
export default function WorkoutHistory({data,onDeleted}:{data:HistoryData;onDeleted:(id:string)=>void}){
 const {t,date,locale}=useLanguage();
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
  catch(error){setMessage(error instanceof Error?error.message:"Could not read backup.")}
  finally{setBusy(false)}
 };
 const restore=async()=>{
  if(!pending||busy)return;setBusy(true);setMessage('');
  try{setReport(await data.restore(pending));setPending(null)}
  catch(error){setMessage(error instanceof Error?error.message:"Import failed.")}
  finally{setBusy(false)}
 };
 const download=async()=>{
  setBusy(true);setMessage('');
  try{
   const text=await data.backup();const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
   const anchor=document.createElement('a');anchor.href=url;anchor.download=`cindy-backup-${new Date().toISOString().slice(0,10)}.json`;
   document.body.appendChild(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){setMessage(error instanceof Error?error.message:"Export failed.")}
  finally{setBusy(false)}
 };
 if(selected)return <WorkoutDetail key={selected.id} record={selected} data={data} onBack={()=>setSelectedId(null)} onDeleted={onDeleted}/>;
 return <>
  <section className="sub-heading"><div><Eyebrow>{t("THE WORK ADDS UP")}</Eyebrow><h1>{t("Your ")}<em>{t("track record.")}</em></h1><p>{t("Small gains. Stronger standards.")}</p></div><span className="pill">{data.records.length}{t(" SAVED SESSIONS")}</span></section>
  {data.error&&<p className="storage-message" role="alert">{t(data.error)}</p>}
  <div className="history-filter"><label htmlFor="analytics-configuration">{t("Analytics configuration")}</label><select id="analytics-configuration" value={configurationKey(configuration)} onChange={e=>setConfigKey(e.target.value)}>{[...configurations].map(([key,c])=><option key={key} value={key}>{t(configurationLabel(c))}</option>)}</select></div>
  <div className="history-stats history-metrics"><Stat label={t("SESSIONS")} value={summary.count}/><Stat label={custom?t("LATEST COMPLETED VOLUME"):t("LATEST SCORE")} value={summary.latest?.totalReps??'—'} unit={t("reps")}/>{custom?<><Stat label={t("COMPLETION RATE")} value={planned?Math.round(completions/planned*100):0} unit="%"/><Stat label={t("COMPLETED VOLUME")} value={trainingRecords.reduce((sum,r)=>sum+r.totalReps,0)} unit={t("reps")}/></>:<><Stat label={t("PERSONAL BEST")} value={summary.best?.chelseaScore?.onTimeRounds??summary.best?.totalReps??'—'} unit={summary.best?.chelseaScore?t("on-time rounds"):t("reps")}/><Stat label={t("VS PREVIOUS")} value={summary.delta===null?'—':`${summary.delta>0?'+':''}${summary.delta}`} unit={t("reps")}/></>}</div>
  <p className="small muted analytics-caption">{custom?t("Training only: completion rate is completed intervals / planned intervals. Completed Volume counts only successfully completed intervals. No PB or benchmark ranking."):configuration.id==='chelsea-standard-v2'?t("Chelsea PB: consecutive on-time rounds, then total rounds, then partial reps."):t("Statistics compare only identical configurations.")}{t(" Session history below includes every configuration.")}</p>
  <section className="panel chart-panel"><SectionTitle title={custom?t("Completed Volume"):t("Moving the benchmark")} detail={t("{0} · TOTAL REPS",[t(configurationLabel(configuration)).toUpperCase()])}/><ProgressChart data={summary.chart}/></section>
  <section className="history-list"><SectionTitle title={t("Session history")} detail={t("NEWEST FIRST · ALL CONFIGURATIONS")}/>
   {data.loading?<p className="empty-state" role="status">{t("Loading your history…")}</p>:!data.records.length?<div className="panel empty-state"><h3>{t("Your first benchmark is ahead.")}</h3><p>{t("Finish a workout and select Save workout. Your records and progress will appear here.")}</p></div>:data.records.map(record=>{
    const best=bests.get(configurationKey(record.configuration))?.id===record.id;
    return <div key={record.id} className="history-item"><button className="history-row" onClick={()=>{setSelectedId(record.id);setMessage('')}} aria-label={t("Open {0}, {1}, {2}",[t(configurationLabel(record.configuration)),date(record.date),t(scoreLabel(record))])}>
     <span className="session-icon"><Dumbbell size={19}/></span><span className="recent-name"><b>{t(configurationLabel(record.configuration))}{best&&<Trophy size={14} className="accent" aria-label={t("Personal best")}/>}</b><span>{date(record.date)} · {formatDuration(record.elapsedDurationMs)}</span></span>
     <span className="history-score"><b>{record.completedRounds} <small>{isCustomEmom(record.configuration)?t("/ {0} intervals",[record.customIntervals!.length]):t("rounds + {0} reps",[record.partialReps])}</small></b><span>{isCustomEmom(record.configuration)?t("Completed Volume: {0} reps",[record.totalReps]):t("{0} total reps",[record.totalReps])}</span></span><ChevronRight size={18}/>
    </button></div>;
   })}
  </section>
  <section className="panel backup-panel"><SectionTitle title={t("Backup & restore")} detail={t("JSON · LOCAL DATA")}/><p className="muted small">{t("Export all saved workouts and Custom EMOM presets. Import merges new IDs. Existing IDs, conflicting presets and previously deleted workout IDs are skipped; nothing is replaced. Malformed entries are rejected and reported. Older backups without presets still work.")}</p>
   <div className="backup-actions"><button disabled={busy||data.loading||!!data.error} onClick={()=>void download()}><Download size={17}/>{t("Export JSON")}</button><button disabled={busy||data.loading||!!data.error} onClick={()=>file.current?.click()}><Upload size={17}/>{t("Import JSON")}</button><input ref={file} type="file" accept="application/json,.json" aria-label={t("Import workout backup")} onChange={e=>void chooseFile(e.target)} hidden/></div>
   {pending&&<div className="import-preview"><p>{pending.records.length}{t(" valid unique records · ")}{pending.rejected}{t(" malformed rejected · ")}{pending.duplicates}{t(" duplicate entries · ")}{pending.conflicts}{t(" conflicting entries.")}</p><p>{pending.presets.length}{t(" valid unique presets · ")}{pending.presetReport.rejected}{t(" malformed presets rejected · ")}{pending.presetReport.duplicates}{t(" duplicate presets · ")}{pending.presetReport.conflicts}{t(" conflicting presets.")}</p><p>{t("Confirm merge? Existing records, presets and deleted IDs will be kept unchanged.")}</p><button className="primary" disabled={busy||(!pending.records.length&&!pending.presets.length)} onClick={()=>void restore()}>{busy?t("IMPORTING…"):t("CONFIRM IMPORT")}</button><button className="text-button" disabled={busy} onClick={()=>setPending(null)}>{t("Cancel import")}</button>{pending.issues.length>0&&<details><summary>{t("Validation details")}</summary><ul>{pending.issues.map((issue,i)=><li key={i}>{t(issue)}</li>)}</ul></details>}</div>}
   {report&&<div className="import-report" role="status"><p>{t("Imported ")}{report.imported}{t(" · Duplicates skipped ")}{report.duplicates}{t(" · Conflicts skipped ")}{report.conflicts}{t(" · Deleted IDs skipped ")}{report.deleted}{t(" · Rejected ")}{report.rejected}</p><p>{t("Presets imported ")}{report.presets.imported}{t(" · Duplicates skipped ")}{report.presets.duplicates}{t(" · Conflicts skipped ")}{report.presets.conflicts}{t(" · Rejected ")}{report.presets.rejected}</p>{report.issues.length>0&&<details><summary>{t("Import details")}</summary><ul>{report.issues.map((issue,i)=><li key={i}>{t(issue)}</li>)}</ul></details>}</div>}
   {message&&<p className="storage-message" role="alert">{t(message)}</p>}
  </section>
 </>;
}

// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '../app/page';
import { exportBackup } from '../lib/history/backup';
import { formatSessionDate, scoreLabel } from '../lib/history/model';
import { listSavedWorkouts, mergeBackup, saveCompletedWorkout } from '../lib/history/repository';
import { parseBackup } from '../lib/history/backup';
import { loadActiveSession, persistActiveSession } from '../lib/workout/storage';
import { BASE, clearTestData, completed, saved } from './history-fixtures';
// Recharts geometry requires a real layout engine. Assert the bound chart data here;
// analytics calculation is tested separately. This is not browser chart rendering coverage.
vi.mock('../components/progress-chart',()=>({default:({data}:{data:{id:string;date:number;reps:number}[]})=><div role="img" aria-label="Progress chart">{data.map(p=>`${p.id}:${p.reps}`).join(',')}</div>}));
const history=()=>fireEvent.click(screen.getAllByRole('button',{name:'History'})[0]);
async function boot(){const view=render(<Home/>);await waitFor(()=>expect((screen.getByRole('button',{name:/Start Cindy Workout|VIEW RESULTS|SAVE WORKOUT|SAVED TO HISTORY/}) as HTMLButtonElement).disabled).toBe(false));return view}
async function openHistory(){const view=render(<Home/>);history();await waitFor(()=>expect(screen.queryByText('Loading your history…')).toBeNull());return view}
function backupFile(text:string){const file=new File([text],'backup.json',{type:'application/json'});Object.defineProperty(file,'text',{value:async()=>text});return file}
function upload(text:string){fireEvent.change(screen.getByLabelText('Import workout backup'),{target:{files:[backupFile(text)]}})}
beforeEach(async()=>{
 await clearTestData();vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
});
afterEach(()=>{cleanup();vi.restoreAllMocks()});
describe('saved history UI flows (DOM simulation)',()=>{
 it('shows real empty states without sample records',async()=>{
  await boot();expect(screen.getByText('No saved workouts yet. Finish a workout and save your score to begin.')).toBeTruthy();
  history();await waitFor(()=>expect(screen.getByText('Your first benchmark is ahead.')).toBeTruthy());
  expect(document.querySelector('.history-metrics')?.textContent).toContain('SESSIONS0');expect(screen.queryByText('Nov 10, 2026')).toBeNull();
 });
 it('saves once, returns to Overview, clears only the finished draft and preserves history on reload',async()=>{
  await persistActiveSession(completed('save-ui',3,12));const view=render(<Home/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'SAVE WORKOUT'})).toBeTruthy());
  const save=screen.getByRole('button',{name:'SAVE WORKOUT'});fireEvent.click(save);fireEvent.click(save);
  await waitFor(()=>expect(screen.getByText('Workout saved to history.')).toBeTruthy());
  expect(await loadActiveSession()).toBeNull();expect(await listSavedWorkouts()).toHaveLength(1);
  expect(screen.queryByLabelText('Partial push-ups')).toBeNull();
  view.unmount();render(<Home/>);await waitFor(()=>expect((screen.getByRole('button',{name:'Start Cindy Workout'}) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.queryByText('YOUR SCORE')).toBeNull();expect((await listSavedWorkouts())[0].partialReps).toBe(12);
 });
 it('opens details, displays all splits, edits notes and retains them across remount',async()=>{
  await saveCompletedWorkout(completed('notes-ui',3));const view=await openHistory();
  fireEvent.click(screen.getByRole('button',{name:/Open Standard Cindy/}));
  expect(screen.getByText('Round 3')).toBeTruthy();expect(screen.getByRole('heading',{name:'Your session.'})).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Session notes'),{target:{value:'My updated notes'}});
  fireEvent.click(screen.getByRole('button',{name:'SAVE NOTES'}));await waitFor(()=>expect(screen.getByText('Notes saved on this device.')).toBeTruthy());
  view.unmount();await openHistory();fireEvent.click(screen.getByRole('button',{name:/Open Standard Cindy/}));
  expect((screen.getByLabelText('Session notes') as HTMLTextAreaElement).value).toBe('My updated notes');
 });
 it('confirms the exact date/score, Cancel preserves all records, and Delete updates PB/chart and survives remount',async()=>{
  await saveCompletedWorkout(completed('lower',2));await saveCompletedWorkout(completed('best',3,12,BASE+1000));
  const records=await listSavedWorkouts();const best=records.find(r=>r.id==='best')!;
  const view=await openHistory();fireEvent.click(screen.getByRole('button',{name:/Open Standard Cindy.*102 total reps/}));
  fireEvent.click(screen.getByRole('button',{name:'Delete workout'}));
  const dialog=screen.getByRole('dialog');expect(dialog.textContent).toContain(formatSessionDate(best.date));expect(dialog.textContent).toContain(scoreLabel(best));
  fireEvent.click(within(dialog).getByRole('button',{name:'Cancel'}));
  expect(screen.queryByRole('dialog')).toBeNull();expect(await listSavedWorkouts()).toHaveLength(2);
  fireEvent.click(screen.getByRole('button',{name:'Delete workout'}));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'DELETE WORKOUT'}));
  await waitFor(()=>expect(screen.getByRole('heading',{name:'Your track record.'})).toBeTruthy());
  expect(document.querySelector('.history-metrics')?.textContent).toContain('PERSONAL BEST60');expect(screen.getByRole('img',{name:'Progress chart'}).textContent).toBe('lower:60');
  view.unmount();await openHistory();expect(screen.queryByRole('button',{name:/102 total reps/})).toBeNull();expect(await listSavedWorkouts()).toHaveLength(1);
 });
 it('shows unavailable split data without inventing timestamps',async()=>{
  const record={...saved('missing',3),completedRoundTimestamps:[1000,null,3000]};await mergeBackup(parseBackup(exportBackup([record])));
  await openHistory();fireEvent.click(screen.getByRole('button',{name:/Open Standard Cindy/}));
  expect(screen.getAllByText('Unavailable')).toHaveLength(2);expect(screen.getByText('No timestamp')).toBeTruthy();
 });
 it('previews import, supports Cancel, merges on confirmation and reports duplicates without overwriting',async()=>{
  const text=exportBackup([saved('import-one',2),saved('import-two',3,0,BASE+1000)]);await openHistory();
  upload(text);await waitFor(()=>expect(screen.getByRole('button',{name:'CONFIRM IMPORT'})).toBeTruthy());expect(await listSavedWorkouts()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'Cancel import'}));expect(await listSavedWorkouts()).toHaveLength(0);
  upload(text);await waitFor(()=>expect(screen.getByRole('button',{name:'CONFIRM IMPORT'})).toBeTruthy());fireEvent.click(screen.getByRole('button',{name:'CONFIRM IMPORT'}));
  await waitFor(()=>expect(screen.getByText(/Imported 2 ·/)).toBeTruthy());expect(document.querySelector('.history-metrics')?.textContent).toContain('PERSONAL BEST90');
  upload(text);await waitFor(()=>expect(screen.getByRole('button',{name:'CONFIRM IMPORT'})).toBeTruthy());fireEvent.click(screen.getByRole('button',{name:'CONFIRM IMPORT'}));
  await waitFor(()=>expect(screen.getByText(/Duplicates skipped 2/)).toBeTruthy());expect(await listSavedWorkouts()).toHaveLength(2);
 });
 it('rejects a malformed file visibly without modifying history',async()=>{
  await saveCompletedWorkout(completed('safe'));await openHistory();upload('broken JSON');
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('not valid JSON'));expect((await listSavedWorkouts()).map(r=>r.id)).toEqual(['safe']);
 });
 it('exports a JSON download containing every saved record and no active draft',async()=>{
  await saveCompletedWorkout(completed('exported'));await openHistory();
  let captured:Blob|null=null;
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:vi.fn((blob:Blob)=>{captured=blob;return 'blob:backup'})});
  Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:vi.fn()});
  const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
  fireEvent.click(screen.getByRole('button',{name:'Export JSON'}));await waitFor(()=>expect(click).toHaveBeenCalled());
  const text=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(captured!)});
  expect(JSON.parse(text).sessions.map((r:{id:string})=>r.id)).toEqual(['exported']);
 });
});

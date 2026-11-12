// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '../app/page';
import { loadActiveSession, persistActiveSession } from '../lib/workout/storage';
import * as storage from '../lib/workout/storage';
import { advance, createWorkout, transition } from '../lib/workout/engine';
const T=1_800_000_000_000;
let clock: ReturnType<typeof vi.spyOn>;
async function at(time:number) {
 clock.mockReturnValue(time);
 await act(async()=>{window.dispatchEvent(new Event('pageshow'))});
}
async function boot() {
 const view=render(<Home/>);
 await waitFor(()=>expect((screen.getByRole('button',{name:/START WORKOUT/}) as HTMLButtonElement).disabled).toBe(false));
 return view;
}
async function start() {
 const view=await boot();
 fireEvent.click(screen.getByRole('button',{name:/START WORKOUT/}));
 return view;
}
async function retained() {
 await waitFor(()=>expect(screen.queryByText('Retaining changes on this device…')).toBeNull());
}
function scoreText() {
 return document.querySelector('.training-stats')?.textContent;
}
beforeEach(async()=>{
 await persistActiveSession(null);
 clock=vi.spyOn(Date,'now').mockReturnValue(T);
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 // jsdom cannot render native dialogs. Stub only those browser APIs, not workout logic.
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
});
afterEach(async()=>{cleanup();await persistActiveSession(null);vi.restoreAllMocks();vi.unstubAllEnvs()});
describe('workout UI and persistence integration (DOM simulation, not Safari)',()=>{
 it('renders 5,4,3,2,1,GO and then the live countdown',async()=>{
  await start();
  for(let n=0;n<5;n++) {
   await at(T+n*1000);expect(screen.getByRole('timer').textContent).toBe(String(5-n));
   expect((screen.getByRole('button',{name:/COMPLETE ROUND/}) as HTMLButtonElement).disabled).toBe(true);
  }
  await at(T+5000);expect(screen.getByRole('timer').textContent).toBe('GO');
  await at(T+6000);expect(screen.getByRole('timer').textContent).toBe('19:59');
  await retained();expect((await loadActiveSession())?.startTime).toBe(T+5000);
 });
 it('synchronously rejects rapid double taps and supports undo',async()=>{
  await start();await at(T+6000);
  const button=screen.getByRole('button',{name:/COMPLETE ROUND/});
  fireEvent.click(button);fireEvent.click(button);
  expect(scoreText()).toContain('COMPLETED ROUNDS1');expect(scoreText()).toContain('TOTAL REPS30');
  await at(T+7000);fireEvent.click(button);
  expect(scoreText()).toContain('TOTAL REPS60');
  fireEvent.click(screen.getByRole('button',{name:/Undo round/}));
  expect(scoreText()).toContain('TOTAL REPS30');
  await retained();expect((await loadActiveSession())?.completedRoundTimestamps).toEqual([1000]);
 });
 it('pauses, survives an original deadline in the background, resumes and expires correctly',async()=>{
  await start();await at(T+6000);fireEvent.click(screen.getByRole('button',{name:'Pause'}));
  await at(T+2_000_000);expect(screen.getByRole('timer').textContent).toBe('19:59');
  expect((screen.getByRole('button',{name:/COMPLETE ROUND/}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Resume'}));
  await at(T+3_198_999);expect(screen.getByRole('timer').textContent).toBe('0:01');
  await at(T+3_199_000);
  await waitFor(()=>expect(screen.getByText('YOUR SCORE')).toBeTruthy());
  await retained();expect((await loadActiveSession())?.completionStatus).toBe('expired');
  expect((await loadActiveSession())?.elapsedDurationMs).toBe(1_200_000);
 });
 it('restores a running session after remount and resolves a missed deadline on pageshow',async()=>{
  const view=await start();await at(T+6000);
  fireEvent.click(screen.getByRole('button',{name:/COMPLETE ROUND/}));await retained();view.unmount();
  clock.mockReturnValue(T+12000);render(<Home/>);
  await waitFor(()=>expect(screen.getByRole('timer').textContent).toBe('19:53'));
  expect(scoreText()).toContain('TOTAL REPS30');
  await at(T+2_000_000);await waitFor(()=>expect(screen.getByText('YOUR SCORE')).toBeTruthy());
  await retained();expect((await loadActiveSession())?.endTime).toBe(T+5000+1_200_000);
 });
 it('finishes, bounds partial reps, and retains notes and effort across refresh',async()=>{
  const view=await start();await at(T+6000);
  fireEvent.click(screen.getByRole('button',{name:/COMPLETE ROUND/}));
  fireEvent.click(screen.getByRole('button',{name:'Finish'}));
  fireEvent.click(screen.getByRole('button',{name:'FINISH WORKOUT'}));
  await waitFor(()=>expect(screen.getByText('YOUR SCORE')).toBeTruthy());
  const input=screen.getByLabelText('Partial pull-ups') as HTMLInputElement;
  fireEvent.change(input,{target:{value:'5'}});
  fireEvent.change(screen.getByLabelText('Partial push-ups'),{target:{value:'7'}});
  fireEvent.click(screen.getByRole('button',{name:'8'}));
  fireEvent.change(screen.getByLabelText(/Session notes/),{target:{value:'Good pacing'}});
  await retained();view.unmount();render(<Home/>);
  await waitFor(()=>expect((screen.getByLabelText('Partial push-ups') as HTMLInputElement).value).toBe('7'));
  expect((screen.getByLabelText(/Session notes/) as HTMLTextAreaElement).value).toBe('Good pacing');
  expect(screen.getByRole('button',{name:'8'}).getAttribute('aria-pressed')).toBe('true');
  expect(document.querySelector('.result-stats')?.textContent).toContain('TOTAL REPS42');
 });
 it('restores the remaining preparation time and can cancel without saving history',async()=>{
  const prep=transition(createWorkout('preparing',T),{type:'start',now:T});
  await persistActiveSession(prep);clock.mockReturnValue(T+2000);render(<Home/>);
  await waitFor(()=>expect(screen.getByRole('timer').textContent).toBe('3'));
  fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  await waitFor(async()=>expect(await loadActiveSession()).toBeNull());
  expect(screen.getByRole('button',{name:/START WORKOUT/})).toBeTruthy();
 });
 it('preserves a paused session on reload and does not record paused time',async()=>{
  const paused=transition(advance(transition(createWorkout('paused',T),{type:'start',now:T}),T+5000),{type:'pause',now:T+7000});
  await persistActiveSession(paused);clock.mockReturnValue(T+2_000_000);render(<Home/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Resume'})).toBeTruthy());
  expect(screen.getByRole('timer').textContent).toBe('19:58');
  fireEvent.click(screen.getByRole('button',{name:'Resume'}));await at(T+2_001_000);
  fireEvent.click(screen.getByRole('button',{name:/COMPLETE ROUND/}));
  await retained();expect((await loadActiveSession())?.completedRoundTimestamps).toEqual([3000]);
 });
 it('offers the 30-second test option only in development',async()=>{
  vi.stubEnv('NODE_ENV','development');await boot();
  fireEvent.click(screen.getByLabelText(/30-second test mode/));
  fireEvent.click(screen.getByRole('button',{name:/START WORKOUT/}));
  await at(T+6000);expect(screen.getByRole('timer').textContent).toBe('0:29');
  await at(T+35000);await waitFor(()=>expect(screen.getByText('YOUR SCORE')).toBeTruthy());
  expect(screen.getByText('Development test · Excluded from standard records')).toBeTruthy();
 });
 it('does not offer development test mode in production',async()=>{
  vi.stubEnv('NODE_ENV','production');await boot();expect(screen.queryByLabelText(/30-second test mode/)).toBeNull();
 });
});

describe('recovery safeguards',()=>{
 it('Cancel in the finish dialog leaves the running workout intact',async()=>{
  await start();await at(T+6000);fireEvent.click(screen.getByRole('button',{name:'Finish'}));
  fireEvent.click(screen.getByRole('button',{name:'Keep going'}));
  expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByRole('timer')).toBeTruthy();
  await retained();expect((await loadActiveSession())?.status).toBe('running');
 });
 it('does not cancel a workout if preparation has elapsed before the next paint',async()=>{
  await start();clock.mockReturnValue(T+6000);
  fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Pause'})).toBeTruthy());
  await retained();expect((await loadActiveSession())?.status).toBe('running');
 });
 it('keeps a completed draft unless replacement is confirmed',async()=>{
  let done=advance(transition(createWorkout('original-draft',T),{type:'start',now:T}),T+1_205_000);
  done=transition(done,{type:'results',now:T+1_205_000,partialReps:12});
  await persistActiveSession(done);clock.mockReturnValue(T+1_206_000);render(<Home/>);
  await waitFor(()=>expect(screen.getByText('YOUR SCORE')).toBeTruthy());
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button',{name:'Start another workout'}));
  expect((await loadActiveSession())?.id).toBe('original-draft');
  confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'Start another workout'}));
  expect(screen.getByRole('timer').textContent).toBe('5');
  await retained();expect((await loadActiveSession())?.id).not.toBe('original-draft');
 });
});


describe('visible storage failure handling',()=>{
 it('reports a failed write, continues in memory, then retains the recovered state on the next action',async()=>{
  await boot();
  vi.spyOn(storage,'persistActiveSession').mockRejectedValueOnce(new Error('quota'));
  fireEvent.click(screen.getByRole('button',{name:/START WORKOUT/}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Local storage failed'));
  expect(screen.getByRole('timer').textContent).toBe('5');
  await at(T+6000);fireEvent.click(screen.getByRole('button',{name:/COMPLETE ROUND/}));
  await retained();expect(screen.queryByRole('alert')).toBeNull();
  expect((await loadActiveSession())?.totalReps).toBe(30);
 });
 it('does not start or overwrite data after recovery fails',async()=>{
  vi.spyOn(storage,'loadActiveSession').mockRejectedValueOnce(new Error('invalid stored session'));
  render(<Home/>);
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Existing data has not been deleted'));
  expect((screen.getByRole('button',{name:/START WORKOUT/}) as HTMLButtonElement).disabled).toBe(true);
 });
});

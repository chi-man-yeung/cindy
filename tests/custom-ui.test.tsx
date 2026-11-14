// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import Home from '../app/page';
import {clearTestData,BASE} from './history-fixtures';
import {openWorkoutDatabase,loadActiveSession} from '../lib/workout/storage';
import {listSavedWorkouts} from '../lib/history/repository';
import {listPresets} from '../lib/workout/presets';
let clock:ReturnType<typeof vi.spyOn>;
beforeEach(async()=>{await clearTestData();const db=await openWorkoutDatabase();await new Promise<void>(resolve=>{const tx=db.transaction('presets','readwrite');tx.objectStore('presets').clear();tx.oncomplete=()=>resolve()});clock=vi.spyOn(Date,'now').mockReturnValue(BASE);vi.spyOn(window,'scrollTo').mockImplementation(()=>{});HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')}});
afterEach(async()=>{await waitFor(()=>expect(screen.queryByText('Retaining changes on this device…')).toBeNull());cleanup();vi.restoreAllMocks()});
async function setup(){render(<Home/>);await waitFor(()=>expect((screen.getByRole('button',{name:'Start Cindy Workout'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Select Custom EMOM'}))}
async function at(t:number){clock.mockReturnValue(t);await act(async()=>{window.dispatchEvent(new Event('pageshow'))})}
it('keeps setup out of benchmark Overview and validates the Custom EMOM summary before Start',async()=>{
 render(<Home/>);expect(screen.queryByLabelText('Duration (minutes)')).toBeNull();cleanup();await setup();
 fireEvent.change(screen.getByLabelText('Duration (minutes)'),{target:{value:'4'}});expect((screen.getByRole('button',{name:'Start Custom EMOM Workout'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Duration (minutes)'),{target:{value:'5'}});fireEvent.change(screen.getByLabelText('Interval (seconds)'),{target:{value:'90'}});
 expect(screen.getByText('Final interval is 30 seconds; the workout ends at 5 minutes.')).toBeTruthy();expect((screen.getByRole('button',{name:'Start Custom EMOM Workout'}) as HTMLButtonElement).disabled).toBe(false);
});
it('adds/removes/reorders exercises and persists/reuses a preset after remount',async()=>{
 await setup();fireEvent.click(screen.getByRole('button',{name:'Add exercise'}));fireEvent.change(screen.getByLabelText('Exercise 3'),{target:{value:'burpees'}});fireEvent.change(screen.getByLabelText('Reps for exercise 3'),{target:{value:'8'}});
 fireEvent.click(screen.getByRole('button',{name:'Move exercise 3 up'}));expect((screen.getByLabelText('Exercise 2') as HTMLSelectElement).value).toBe('burpees');fireEvent.click(screen.getByRole('button',{name:'Remove exercise 3'}));
 fireEvent.change(screen.getByLabelText('Preset name'),{target:{value:'Strength focus'}});fireEvent.click(screen.getByRole('button',{name:'Save preset'}));await waitFor(()=>expect(screen.getByText('Preset saved on this device.')).toBeTruthy());const id=(await listPresets())[0].id;
 cleanup();await setup();await waitFor(()=>expect(screen.getByRole('option',{name:'Strength focus'})).toBeTruthy());fireEvent.change(screen.getByLabelText('Reuse preset'),{target:{value:id}});expect((screen.getByLabelText('Exercise 2') as HTMLSelectElement).value).toBe('burpees');expect((screen.getByLabelText('Reps for exercise 2') as HTMLInputElement).value).toBe('8');
});
it('starts once, recovers timing, saves early/incomplete training and shows no PB or ranking',async()=>{
 await setup();fireEvent.change(screen.getByLabelText('Duration (minutes)'),{target:{value:'5'}});fireEvent.click(screen.getByRole('button',{name:'Start Custom EMOM Workout'}));expect(screen.getByRole('timer').textContent).toBe('5');
 await at(BASE+6000);fireEvent.click(screen.getByRole('button',{name:/COMPLETE INTERVAL/}));await waitFor(async()=>expect((await loadActiveSession())?.totalReps).toBe(15));
 cleanup();render(<Home/>);await waitFor(()=>expect(screen.getByRole('timer').textContent).toBe('0:59'));await at(BASE+66000);
 fireEvent.click(screen.getByRole('button',{name:'Finish'}));fireEvent.click(screen.getByRole('button',{name:'FINISH WORKOUT'}));expect(screen.getByText('TRAINING SUMMARY')).toBeTruthy();expect(screen.queryByLabelText('Partial pull-ups')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'SAVE WORKOUT'}));await waitFor(()=>expect(screen.getByText('Workout saved to history.')).toBeTruthy());const record=(await listSavedWorkouts())[0];expect(record.totalReps).toBe(15);expect(record.customIntervals![1].status).toBe('incomplete');
 fireEvent.click(screen.getAllByRole('button',{name:'History'})[0]);const select=screen.getByLabelText('Analytics configuration');const options=Array.from((select as HTMLSelectElement).options);fireEvent.change(select,{target:{value:options.find(o=>o.text.includes('Custom EMOM'))!.value}});
 expect(screen.getByText('COMPLETION RATE')).toBeTruthy();expect(screen.queryByText('PERSONAL BEST')).toBeNull();expect(screen.queryByLabelText('Personal best')).toBeNull();expect(screen.getByText('COMPLETED VOLUME')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:/Open Custom EMOM/}));expect(screen.getByText('Interval record')).toBeTruthy();expect(screen.getByText('Interval 2 · 1:00–2:00')).toBeTruthy();
});

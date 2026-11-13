// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {act,cleanup,fireEvent,render,renderHook,screen,waitFor} from '@testing-library/react';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import Home from '../app/page';
import {useWorkout} from '../lib/workout/use-workout';
import {loadActiveSession,persistActiveSession} from '../lib/workout/storage';
import {listSavedWorkouts,saveCompletedWorkout} from '../lib/history/repository';
import {clearTestData,completed,BASE} from './history-fixtures';
let clock:ReturnType<typeof vi.spyOn>;
beforeEach(async()=>{await clearTestData();clock=vi.spyOn(Date,'now').mockReturnValue(BASE);vi.spyOn(window,'scrollTo').mockImplementation(()=>{});HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')}});
afterEach(()=>{cleanup();vi.restoreAllMocks()});
async function boot(){render(<Home/>);await waitFor(()=>expect((screen.getByRole('button',{name:'Start Cindy Workout'}) as HTMLButtonElement).disabled).toBe(false))}
async function at(t:number){clock.mockReturnValue(t);await act(async()=>{window.dispatchEvent(new Event('pageshow'))})}
it('uses equal grid tracks and balanced stretching cards (CSS contract, not device geometry)',()=>{
 const css=readFileSync('app/globals.css','utf8');expect(css).toContain('.mode-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))');expect(css).toContain('align-items:stretch');
});
it('changes the selected state and primary CTA, then starts Chelsea with five-second preparation',async()=>{
 await boot();expect(screen.getByRole('button',{name:'Select Cindy'}).getAttribute('aria-pressed')).toBe('true');fireEvent.click(screen.getByRole('button',{name:'Select Chelsea'}));
 expect(screen.getByRole('button',{name:'Select Chelsea'}).getAttribute('aria-pressed')).toBe('true');fireEvent.click(screen.getByRole('button',{name:'Start Chelsea Workout'}));
 expect(screen.getByRole('timer').textContent).toBe('5');await at(BASE+4000);expect(screen.getByRole('timer').textContent).toBe('1');await at(BASE+5000);expect(screen.getByRole('timer').textContent).toBe('GO');
});
it('Workout is an empty destination, and Choose Workout returns to the sole start flow',async()=>{
 await boot();fireEvent.click(screen.getByRole('button',{name:'Workout'}));expect(screen.getByText('No active workout.')).toBeTruthy();expect(await loadActiveSession()).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Choose Workout'}));fireEvent.click(screen.getByRole('button',{name:'Start Cindy Workout'}));expect(screen.getByRole('timer').textContent).toBe('5');
});
it('does not duplicate starts even before React rerenders',async()=>{
 const {result}=renderHook(()=>useWorkout());await waitFor(()=>expect(result.current.ready).toBe(true));
 let id:string|undefined;act(()=>{expect(result.current.start()).toBe(true);id=result.current.session?.id;expect(result.current.start()).toBe(false)});
 const activeId=result.current.session!.id;await waitFor(async()=>expect((await loadActiveSession())?.id).toBe(activeId));expect(result.current.session?.completedRoundTimestamps).toHaveLength(0);
});
it('confirms replacement, Cancel preserves progress, and saved records survive replacement',async()=>{
 await saveCompletedWorkout(completed('existing'));await boot();fireEvent.click(screen.getByRole('button',{name:'Start Cindy Workout'}));await at(BASE+6000);
 fireEvent.click(screen.getByRole('button',{name:/COMPLETE ROUND/}));await waitFor(async()=>expect((await loadActiveSession())?.totalReps).toBe(30));const old=(await loadActiveSession())!.id;
 fireEvent.click(screen.getAllByRole('button',{name:'Overview'})[0]);fireEvent.click(screen.getByRole('button',{name:'Select Chelsea'}));const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
 fireEvent.click(screen.getByRole('button',{name:'Start Chelsea Workout'}));expect((await loadActiveSession())?.id).toBe(old);
 confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'Start Chelsea Workout'}));await waitFor(async()=>expect((await loadActiveSession())?.id).not.toBe(old));expect((await listSavedWorkouts()).map(r=>r.id)).toEqual(['existing']);
});
it('Save → Overview → Chelsea → Save leaves no stale result or duplicate record after refresh',async()=>{
 await persistActiveSession(completed('first'));render(<Home/>);await waitFor(()=>expect(screen.getByRole('button',{name:'SAVE WORKOUT'})).toBeTruthy());fireEvent.click(screen.getByRole('button',{name:'SAVE WORKOUT'}));
 await waitFor(()=>expect(screen.getByText('Workout saved to history.')).toBeTruthy());expect(await loadActiveSession()).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Select Chelsea'}));fireEvent.click(screen.getByRole('button',{name:'Start Chelsea Workout'}));
 await at(BASE+5000+1800000);fireEvent.click(screen.getByRole('button',{name:'SAVE WORKOUT'}));await waitFor(()=>expect(screen.getByText('Workout saved to history.')).toBeTruthy());expect(await listSavedWorkouts()).toHaveLength(2);expect(await loadActiveSession()).toBeNull();
 cleanup();await boot();expect(screen.queryByText('YOUR SCORE')).toBeNull();expect(await listSavedWorkouts()).toHaveLength(2);
});
it('keeps an unsaved results draft accessible without turning Workout into a Start flow',async()=>{
 await persistActiveSession(completed('draft'));render(<Home/>);await waitFor(()=>expect(screen.getByText('YOUR SCORE')).toBeTruthy());
 fireEvent.click(screen.getByRole('button',{name:'Workout'}));expect(screen.getByText('No active workout.')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Review unsaved results'}));expect(screen.getByText('YOUR SCORE')).toBeTruthy();expect((await loadActiveSession())?.id).toBe('draft');
});

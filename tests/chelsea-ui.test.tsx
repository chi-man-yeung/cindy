// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import Home from '../app/page';
import {clearTestData} from './history-fixtures';
import {listSavedWorkouts} from '../lib/history/repository';
it('selects Chelsea, completes a minute, recovers expiry and saves its minute results',async()=>{
 await clearTestData();const clock=vi.spyOn(Date,'now').mockReturnValue(1700000000000);vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 const view=render(<Home/>);
 try{
  await waitFor(()=>expect((screen.getByRole('button',{name:/Start Cindy Workout/}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'Select Chelsea'}));fireEvent.click(screen.getByRole('button',{name:/Start Chelsea Workout/}));
  clock.mockReturnValue(1700000006000);await act(async()=>{window.dispatchEvent(new Event('pageshow'))});
  expect(screen.getByText('MINUTE 1 OF 30 · TIME IN MINUTE')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:/COMPLETE THIS MINUTE/}));
  clock.mockReturnValue(1700001805000);await act(async()=>{window.dispatchEvent(new Event('pageshow'))});
  expect(screen.getByText('1 completed · 1 missed · 0 incomplete')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'SAVE WORKOUT'}));
  await waitFor(()=>expect(screen.getByText('Workout saved to history.')).toBeTruthy());
  const records=await listSavedWorkouts();expect(records[0].chelseaMinutes).toHaveLength(30);expect(records[0].totalReps).toBe(30);
 }finally{view.unmount();cleanup();vi.restoreAllMocks()}
});
it('switches unobtrusively to remaining-time AMRAP and saves on-time/post-transition/partial scores',async()=>{
 await clearTestData();const base=1700000000000;const clock=vi.spyOn(Date,'now').mockReturnValue(base);vi.spyOn(window,'scrollTo').mockImplementation(()=>{});const view=render(<Home/>);
 try{
  await waitFor(()=>expect((screen.getByRole('button',{name:'Start Cindy Workout'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Select Chelsea'}));fireEvent.click(screen.getByRole('button',{name:'Start Chelsea Workout'}));
  clock.mockReturnValue(base+6000);await act(async()=>{window.dispatchEvent(new Event('pageshow'))});fireEvent.click(screen.getByRole('button',{name:/COMPLETE THIS MINUTE/}));
  clock.mockReturnValue(base+125000);await act(async()=>{window.dispatchEvent(new Event('pageshow'))});expect(screen.getByRole('timer').textContent).toBe('28:00');
  expect(screen.getByText('Continue the unfinished round. The 30-minute clock has not reset.')).toBeTruthy();const round=screen.getByRole('button',{name:/COMPLETE ROUND/});fireEvent.click(round);fireEvent.click(round);
  clock.mockReturnValue(base+1805000);await act(async()=>{window.dispatchEvent(new Event('pageshow'))});
  fireEvent.change(screen.getByLabelText('Partial pull-ups'),{target:{value:'5'}});fireEvent.change(screen.getByLabelText('Partial push-ups'),{target:{value:'10'}});fireEvent.change(screen.getByLabelText('Partial air squats'),{target:{value:'14'}});
  fireEvent.click(screen.getByRole('button',{name:'SAVE WORKOUT'}));await waitFor(()=>expect(screen.getByText('Workout saved to history.')).toBeTruthy());
  const record=(await listSavedWorkouts())[0];expect(record.chelseaScore).toMatchObject({onTimeRounds:1,postTransitionRounds:1,totalRounds:2,transitionElapsedMs:120000});expect(record.partialReps).toBe(29);expect(record.totalReps).toBe(89);
 }finally{view.unmount();cleanup();vi.restoreAllMocks()}
});

// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import Home from '../app/page';
import {clearTestData,BASE,completed} from './history-fixtures';
import {loadActiveSession} from '../lib/workout/storage';
import {listSavedWorkouts,saveCompletedWorkout} from '../lib/history/repository';
import {savePreset,listPresets} from '../lib/workout/presets';
import {DEFAULT_CUSTOM} from '../lib/workout/custom-config';
import {LANGUAGE_KEY,translate} from '../lib/i18n/translate';
let clock:ReturnType<typeof vi.spyOn>;
beforeEach(async()=>{localStorage.clear();await clearTestData();clock=vi.spyOn(Date,'now').mockReturnValue(BASE);vi.spyOn(window,'scrollTo').mockImplementation(()=>{});HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')}});
afterEach(async()=>{await waitFor(()=>expect(screen.queryByText(/Retaining changes on this device|正在此裝置保留變更/)).toBeNull());cleanup();vi.restoreAllMocks();localStorage.clear();document.documentElement.lang='en'});
async function boot(){render(<Home/>);await waitFor(()=>expect(screen.getByRole('button',{name:localStorage.getItem(LANGUAGE_KEY)==='zh-Hant'?'開始 Cindy 訓練':'Start Cindy Workout'}).hasAttribute('disabled')).toBe(false))}
async function at(time:number){clock.mockReturnValue(time);await act(async()=>{window.dispatchEvent(new Event('pageshow'))})}
function chinese(){fireEvent.click(screen.getByRole('button',{name:'繁體中文'}))}
it('switches navigation and all mode CTAs, updates document language and persists preference across remount',async()=>{
 await boot();chinese();expect(document.documentElement.lang).toBe('zh-Hant');expect(document.title).toContain('再多一輪');expect(localStorage.getItem(LANGUAGE_KEY)).toBe('zh-Hant');expect(screen.getByRole('button',{name:'開始 Cindy 訓練'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'選擇 Chelsea'}));expect(screen.getByRole('button',{name:'開始 Chelsea 訓練'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'選擇 自訂 EMOM'}));expect(screen.getByLabelText('訓練時長（分鐘）')).toBeTruthy();expect(screen.getByRole('button',{name:'開始自訂 EMOM 訓練'})).toBeTruthy();
 cleanup();await boot();expect(screen.getByRole('button',{name:'繁體中文'}).getAttribute('aria-pressed')).toBe('true');fireEvent.click(screen.getByRole('button',{name:'English'}));expect(document.documentElement.lang).toBe('en');expect(screen.getByRole('button',{name:'Start Cindy Workout'})).toBeTruthy();
});
it('switches during preparation, round tracking and pause without replacing or changing the active session',async()=>{
 await boot();fireEvent.click(screen.getByRole('button',{name:'Start Cindy Workout'}));await waitFor(async()=>expect(await loadActiveSession()).not.toBeNull());const id=(await loadActiveSession())!.id;
 chinese();expect(screen.getByRole('timer').textContent).toBe('5');await at(BASE+5000);expect(screen.getByRole('timer').textContent).toBe('開始');await at(BASE+6000);fireEvent.click(screen.getByRole('button',{name:/完成一輪/}));await waitFor(async()=>expect((await loadActiveSession())!.totalReps).toBe(30));
 fireEvent.click(screen.getByRole('button',{name:'暫停'}));await waitFor(async()=>expect((await loadActiveSession())!.status).toBe('paused'));const before=await loadActiveSession();fireEvent.click(screen.getByRole('button',{name:'English'}));expect(screen.getByRole('button',{name:'Resume'})).toBeTruthy();expect(await loadActiveSession()).toEqual(before);expect(before!.id).toBe(id);
});
it('saves from Chinese results then edits notes and cancels deletion in Chinese without translating stored text',async()=>{
 await boot();chinese();fireEvent.click(screen.getByRole('button',{name:'開始 Cindy 訓練'}));await at(BASE+6000);fireEvent.click(screen.getByRole('button',{name:/完成一輪/}));fireEvent.click(screen.getByRole('button',{name:'結束'}));fireEvent.click(screen.getByRole('button',{name:'結束訓練'}));expect(screen.getByText('你的成績')).toBeTruthy();
 fireEvent.change(screen.getByLabelText(/訓練筆記/),{target:{value:'History 保持原文'}});fireEvent.click(screen.getByRole('button',{name:'儲存訓練'}));await waitFor(()=>expect(screen.getByText('訓練已儲存至紀錄。')).toBeTruthy());expect((await listSavedWorkouts())[0].notes).toBe('History 保持原文');
 fireEvent.click(screen.getAllByRole('button',{name:'紀錄'})[0]);fireEvent.click(screen.getByRole('button',{name:/開啟 標準 Cindy/}));fireEvent.change(screen.getByLabelText('訓練筆記'),{target:{value:'My notes 我的筆記'}});fireEvent.click(screen.getByRole('button',{name:'儲存筆記'}));await waitFor(()=>expect(screen.getByText('筆記已儲存在此裝置。')).toBeTruthy());
 fireEvent.click(screen.getByRole('button',{name:'刪除訓練'}));expect(screen.getByRole('heading',{name:'刪除這筆訓練？'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'取消'}));expect(await listSavedWorkouts()).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:'English'}));expect(screen.getByDisplayValue('My notes 我的筆記')).toBeTruthy();
});
it('keeps preset identities and prescriptions unchanged and localizes validation/backup screens',async()=>{
 const preset=await savePreset('Strength 力量',DEFAULT_CUSTOM);await saveCompletedWorkout(completed('safe'));const before=await listSavedWorkouts();await boot();chinese();fireEvent.click(screen.getByRole('button',{name:'選擇 自訂 EMOM'}));await waitFor(()=>expect(screen.getByRole('option',{name:'Strength 力量'})).toBeTruthy());fireEvent.change(screen.getByLabelText('使用預設訓練'),{target:{value:preset.id}});fireEvent.change(screen.getByLabelText('訓練時長（分鐘）'),{target:{value:'4'}});expect(screen.getByRole('alert').textContent).toContain('請選擇 5–30');expect((await listPresets()).find(p=>p.id===preset.id)).toEqual(preset);
 fireEvent.click(screen.getAllByRole('button',{name:'紀錄'})[0]);expect(screen.getByText('備份與還原')).toBeTruthy();expect(screen.getByRole('button',{name:'匯出 JSON'})).toBeTruthy();expect(screen.getByRole('button',{name:'匯入 JSON'})).toBeTruthy();expect(await listSavedWorkouts()).toEqual(before);
});
it('falls back to English for invalid preference and supports switching with storage blocked',async()=>{
 localStorage.setItem(LANGUAGE_KEY,'invalid');await boot();const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked')});chinese();expect(screen.getByRole('button',{name:'開始 Cindy 訓練'})).toBeTruthy();spy.mockRestore();
});
it('interpolates dynamic labels and nested diagnostics without altering values',()=>{
 expect(translate('zh-Hant','INTERVAL {0} OF {1} · TIME IN INTERVAL',[2,4])).toBe('間歇 2／4 · 本間歇剩餘時間');expect(translate('en','Exercise {0}',[3])).toBe('Exercise 3');expect(translate('zh-Hant','Custom EMOM · 5 min · 90s')).toBe('自訂 EMOM · 5 分鐘 · 90 秒');expect(translate('zh-Hant','Entry 2: Invalid interval plan.')).toBe('項目 2：間歇計劃無效。');expect(translate('zh-Hant','1 of 4 intervals · Completed Volume: 15 reps')).toBe('1／4 個間歇 · 已完成訓練量：15 次');expect(translate('zh-Hant','3 rounds + 5 reps · 95 total reps')).toBe('3 輪 + 5 次 · 共 95 次');expect(translate('zh-Hant','Unknown diagnostic')).toBe('Unknown diagnostic');
});

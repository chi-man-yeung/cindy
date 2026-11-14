import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import {CHELSEA_LEGACY as CHELSEA,advanceChelsea,transitionChelsea} from '../lib/workout/chelsea';
import {createWorkout,STANDARD_CINDY} from '../lib/workout/engine';
import {validateSession} from '../lib/workout/validation';
import {recordFromSession,validateSavedWorkout} from '../lib/history/model';
import {analytics} from '../lib/history/analytics';
import {exportBackup,parseBackup} from '../lib/history/backup';
const start=()=>transitionChelsea(createWorkout('chelsea',0,CHELSEA),{type:'start',now:0});
it('schedules all 30 minute boundaries and expires exactly at 30 minutes',()=>{
 for(let i=0;i<30;i++){const s=advanceChelsea(start(),5000+i*60000);expect(s.status).toBe('running');expect(s.chelseaMinutes!.filter(m=>m.status==='missed')).toHaveLength(i)}
 const end=advanceChelsea(start(),5000+1800000);expect(end.status).toBe('completed');expect(end.chelseaMinutes!.filter(m=>m.status==='missed')).toHaveLength(30);
});
it('accepts one on-time completion per minute and rejects late taps at the boundary',()=>{
 let s=transitionChelsea(start(),{type:'round',now:6000,minute:1});s=transitionChelsea(s,{type:'round',now:7000,minute:1});expect(s.totalReps).toBe(30);
 s=transitionChelsea(s,{type:'round',now:65000,minute:1});expect(s.totalReps).toBe(30);
 s=transitionChelsea(s,{type:'round',now:65000,minute:2});expect(s.totalReps).toBe(60);
 expect(validateSession(s)).toEqual(s);
});
it('tracks explicit incomplete minutes and missed minutes separately',()=>{
 let s=transitionChelsea(start(),{type:'incomplete',now:6000,minute:1});s=advanceChelsea(s,125000);
 expect(s.chelseaMinutes![0].status).toBe('incomplete');expect(s.chelseaMinutes![1].status).toBe('missed');expect(s.totalReps).toBe(0);
});
it('excludes pauses from minute scheduling and resolves a background suspension',()=>{
 let s=transitionChelsea(start(),{type:'pause',now:35000});s=advanceChelsea(s,500000);expect(s.elapsedDurationMs).toBe(30000);
 s=transitionChelsea(s,{type:'resume',now:500000});s=advanceChelsea(s,530000);expect(s.elapsedDurationMs).toBe(60000);expect(s.chelseaMinutes![0].status).toBe('missed');
 s=advanceChelsea(s,3000000);expect(s.status).toBe('completed');expect(validateSession(s)).toEqual(s);
});
it('persists Chelsea results, backs up minutes and keeps performance separate',()=>{
 let s=transitionChelsea(start(),{type:'round',now:6000,minute:1});s=transitionChelsea(s,{type:'finish',now:7000});
 const r=recordFromSession(s,8000);expect(r.chelseaMinutes![1].status).toBe('not-started');expect(validateSavedWorkout(JSON.parse(JSON.stringify(r)))).toEqual(r);
 expect(parseBackup(exportBackup([r])).records[0]).toEqual(r);expect(analytics([r],STANDARD_CINDY).count).toBe(0);expect(analytics([r],CHELSEA).best?.totalReps).toBe(30);
});

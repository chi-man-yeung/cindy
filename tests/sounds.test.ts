// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkoutSounds } from '../lib/workout/sounds';
afterEach(()=>vi.unstubAllGlobals());
describe('optional foreground sound adapter',()=>{
 it('does not interrupt a workout if Web Audio is unavailable',async()=>{
  vi.stubGlobal('AudioContext',undefined);
  const sound=new WorkoutSounds();await expect(sound.unlock()).resolves.toBeUndefined();
  expect(()=>sound.cue('5')).not.toThrow();sound.close();
 });
 it('handles a browser refusal to resume audio',async()=>{
  class Unsupported { resume(){return Promise.reject(new Error('Not allowed'))} close(){return Promise.resolve()} }
  vi.stubGlobal('AudioContext',Unsupported);
  await expect(new WorkoutSounds().unlock()).resolves.toBeUndefined();
 });
 it('plays through Web Audio only when its context is running',async()=>{
  const stop=vi.fn();const start=vi.fn();const frequency={value:0};
  const oscillator={frequency,connect:vi.fn(),start,stop,disconnect:vi.fn(),onended:null};
  const gain={gain:{setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()};
  class Audio {state='running';currentTime=10;destination={};resume(){return Promise.resolve()}close(){return Promise.resolve()}createOscillator(){return oscillator}createGain(){return gain}}
  vi.stubGlobal('AudioContext',Audio);
  const sound=new WorkoutSounds();await sound.unlock();sound.cue('GO');
  expect(start).toHaveBeenCalled();expect(stop).toHaveBeenCalledWith(10.15);expect(frequency.value).toBe(880);
  sound.close();
 });
});

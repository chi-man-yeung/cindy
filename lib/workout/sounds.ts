/** Best-effort foreground cues. iOS may suspend audio; never used for timing. */
export class WorkoutSounds {
  private context: AudioContext | null = null;
  async unlock() {
    try {
      const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Audio) return;
      this.context ??= new Audio();
      await this.context.resume();
    } catch { /* Sound is optional. */ }
  }
  cue(kind: string) {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = kind === 'GO' ? 880 : kind === 'complete' ? 660 : 440;
      const end = context.currentTime + (kind === 'complete' ? .5 : .15);
      gain.gain.setValueAtTime(.12,context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001,end);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(); oscillator.stop(end);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch { /* Unsupported or interrupted audio must not interrupt a workout. */ }
  }
  close() { void this.context?.close().catch(()=>{}); this.context = null; }
}

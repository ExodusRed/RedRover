// Sound effects synthesized with the Web Audio API — no audio files needed.
// Every sound is built from oscillators (tones) or noise, shaped by volume and pitch envelopes.

import { GameEvent } from './game';

const MUTE_KEY = 'redrover.muted';

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private cellStep = 0;
  muted = loadMuted();

  /** Browsers only allow audio after a user gesture, so call this from key/touch handlers. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  play(events: GameEvent[]): void {
    if (!this.ctx || this.muted) return;
    for (const e of events) {
      switch (e.type) {
        case 'start':
          this.tone(440, 0, 0.08, 'square', 0.12);
          this.tone(660, 0.09, 0.12, 'square', 0.12);
          break;
        case 'cell':
          // Soft tick that walks up a small scale, so collecting a row sounds like a little melody.
          this.cellStep = (this.cellStep + 1) % 5;
          this.tone([880, 988, 1109, 1175, 1319][this.cellStep], 0, 0.05, 'triangle', 0.12);
          break;
        case 'emp':
          this.sweep(200, 1600, 0, 0.35, 'sawtooth', 0.12);
          this.noise(0.05, 0.3, 0.08, 3000);
          break;
        case 'empEnd':
          this.sweep(900, 300, 0, 0.25, 'sine', 0.12);
          break;
        case 'ram': {
          // Each drone in a chain zaps a step higher.
          const base = 300 * 2 ** ((e.chain - 1) * 0.5);
          this.sweep(base * 3, base, 0, 0.18, 'square', 0.14);
          this.tone(base * 4, 0.12, 0.12, 'triangle', 0.12);
          break;
        }
        case 'hit':
          this.noise(0, 0.7, 0.35, 1200);
          this.sweep(400, 50, 0, 0.6, 'sawtooth', 0.18);
          break;
        case 'clear':
          [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.11, 0.16, 'square', 0.1));
          this.tone(1319, 0.48, 0.35, 'triangle', 0.14);
          break;
        case 'over':
          [392, 330, 262, 196].forEach((f, i) => this.tone(f, i * 0.2, 0.22, 'triangle', 0.16));
          break;
      }
    }
  }

  // ------------------------------------------------------------ building blocks

  /** A single note with a quick attack and exponential fade-out. */
  private tone(freq: number, delay: number, duration: number, type: OscillatorType, volume: number): void {
    this.sweep(freq, freq, delay, duration, type, volume);
  }

  /** A note whose pitch slides from `from` to `to`. */
  private sweep(from: number, to: number, delay: number, duration: number, type: OscillatorType, volume: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  /** A burst of filtered white noise — explosions, static, crackle. */
  private noise(delay: number, duration: number, volume: number, cutoff: number): void {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) {
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(t);
    src.stop(t + duration);
  }
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

class RetroAudioEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private lastWarnSec: number = -1;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'square',
    volume: number = 0.12,
    delay: number = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freqStart), now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.015);
  }

  public jump(isBig: boolean): void {
    this.playTone(isBig ? 220 : 300, isBig ? 540 : 680, 0.14, 'square', 0.11);
  }

  public swim(): void {
    this.playTone(210, 380, 0.12, 'triangle', 0.12);
  }

  public coin(): void {
    this.playTone(987.77, 987.77, 0.07, 'square', 0.1);
    this.playTone(1318.51, 1318.51, 0.18, 'square', 0.1, 0.07);
  }

  public heart(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this.playTone(n, n, 0.08, 'triangle', 0.14, i * 0.065);
    });
  }

  public powerup(): void {
    const notes = [392, 493.88, 587.33, 783.99, 987.77, 1174.66];
    notes.forEach((n, i) => {
      this.playTone(n, n, 0.065, 'square', 0.1, i * 0.055);
    });
  }

  public bump(): void {
    this.playTone(150, 95, 0.08, 'triangle', 0.14);
  }

  public breakBrick(): void {
    this.playTone(260, 80, 0.12, 'sawtooth', 0.12);
    this.playTone(180, 65, 0.1, 'square', 0.09, 0.03);
  }

  public fireball(): void {
    this.playTone(720, 220, 0.09, 'sawtooth', 0.09);
  }

  public stomp(): void {
    this.playTone(420, 140, 0.1, 'square', 0.12);
  }

  public kickShell(): void {
    this.playTone(320, 620, 0.09, 'square', 0.11);
  }

  public hurt(): void {
    this.playTone(340, 110, 0.24, 'sawtooth', 0.13);
    this.playTone(260, 85, 0.24, 'square', 0.1, 0.06);
  }

  public bossHit(): void {
    this.playTone(540, 180, 0.14, 'sawtooth', 0.14);
    this.playTone(220, 90, 0.16, 'square', 0.12, 0.05);
  }

  public bossDefeat(): void {
    const fanfare = [392, 523.25, 659.25, 783.99, 659.25, 1046.5];
    fanfare.forEach((n, i) => {
      this.playTone(n, n, i === fanfare.length - 1 ? 0.35 : 0.11, 'square', 0.13, i * 0.095);
    });
  }

  public flagpole(): void {
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    notes.forEach((n, i) => {
      this.playTone(n, n, 0.11, 'square', 0.12, i * 0.09);
    });
  }

  public timeWarning(sec: number): void {
    if (sec !== this.lastWarnSec && sec > 0 && sec <= 30) {
      this.lastWarnSec = sec;
      if (sec <= 10 || sec % 5 === 0) {
        this.playTone(880, 880, 0.07, 'square', 0.08);
      }
    }
  }

  public resetTimeWarn(): void {
    this.lastWarnSec = -1;
  }

  public timeUp(): void {
    this.playTone(440, 220, 0.18, 'sawtooth', 0.14);
    this.playTone(330, 140, 0.28, 'sawtooth', 0.14, 0.18);
  }

  public countdownTick(sec: number): void {
    const freq = sec === 1 ? 784 : 523.25;
    this.playTone(freq, freq, 0.08, 'square', 0.09);
  }

  public gameOver(): void {
    const notes = [392, 349.23, 329.63, 293.66, 261.63];
    notes.forEach((n, i) => {
      this.playTone(n, n * 0.92, i === notes.length - 1 ? 0.45 : 0.16, 'triangle', 0.15, i * 0.15);
    });
  }

  public checkpoint(): void {
    this.playTone(587.33, 587.33, 0.08, 'triangle', 0.12);
    this.playTone(880, 880, 0.14, 'triangle', 0.12, 0.08);
  }
}

export const audio = new RetroAudioEngine();

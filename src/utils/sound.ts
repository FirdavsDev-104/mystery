class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  public setEnabled(val: boolean) {
    this.enabled = val;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
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

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.12, slideTo?: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.02);
    } catch {
      // Ignore audio failures when blocked by autoplay policies
    }
  }

  public playClick() {
    this.playTone(540, 0.07, 'triangle', 0.08, 760);
  }

  public playCollect() {
    this.playTone(620, 0.1, 'sine', 0.12, 980);
    setTimeout(() => this.playTone(980, 0.12, 'triangle', 0.1, 1320), 60);
  }

  public playJump() {
    this.playTone(260, 0.16, 'sine', 0.11, 560);
  }

  public playBuild() {
    this.playTone(210, 0.09, 'square', 0.07, 140);
  }

  public playGoal() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 0.18, 'triangle', 0.12), i * 85);
    });
  }

  public playSuccess() {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 0.16, 'sine', 0.11), i * 75);
    });
  }

  public playError() {
    this.playTone(220, 0.18, 'sawtooth', 0.08, 130);
  }

  public playEngineTick(speedRatio: number) {
    const freq = 65 + Math.min(1, Math.max(0, speedRatio)) * 110;
    this.playTone(freq, 0.06, 'sawtooth', 0.03);
  }

  public playAnimalCall(kind: string) {
    switch (kind) {
      case 'sheep':
        this.playTone(340, 0.25, 'triangle', 0.11, 300);
        setTimeout(() => this.playTone(330, 0.22, 'triangle', 0.09, 280), 150);
        break;
      case 'cow':
        this.playTone(145, 0.45, 'sawtooth', 0.09, 120);
        break;
      case 'lion':
        this.playTone(160, 0.35, 'sawtooth', 0.12, 85);
        break;
      case 'elephant':
        this.playTone(380, 0.35, 'triangle', 0.12, 620);
        break;
      default:
        this.playTone(580, 0.12, 'sine', 0.1, 740);
        break;
    }
  }
}

export const soundEngine = new SoundEngine();

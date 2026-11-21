/**
 * Lightweight Web Audio synthesized SFX for crisp tactile feedback on bombs,
 * switches, braziers, keys, and boss phases.
 */

export interface SfxPlayer {
  muted: boolean;
  play(event: string): void;
}

export function makeSfx(): SfxPlayer {
  let ctx: AudioContext | null = null;
  const ensure = (): AudioContext | null => {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
    if (!ctx) {
      ctx = new window.AudioContext();
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    return ctx;
  };

  const tone = (
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainPeak = 0.14,
    delay = 0,
  ): void => {
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  };

  return {
    muted: false,
    play(ev: string) {
      if (this.muted) return;
      if (ev === 'bomb-drop') {
        tone(240, 140, 0.07, 'sine', 0.12);
      } else if (ev === 'bomb-throw') {
        tone(280, 520, 0.1, 'triangle', 0.13);
      } else if (ev === 'boom-powder') {
        tone(150, 38, 0.24, 'sawtooth', 0.22);
        tone(95, 28, 0.28, 'square', 0.14);
      } else if (ev === 'boom-ember') {
        tone(340, 110, 0.22, 'sawtooth', 0.18);
        tone(620, 260, 0.18, 'triangle', 0.12, 0.03);
      } else if (ev === 'crystal-flip') {
        tone(587, 880, 0.14, 'sine', 0.15);
      } else if (ev === 'torch-lit' || ev === 'armor-burn') {
        tone(440, 660, 0.14, 'triangle', 0.15);
      } else if (ev === 'torch-fizzle') {
        tone(320, 150, 0.18, 'sawtooth', 0.12);
      } else if (ev === 'armor-clank') {
        tone(820, 410, 0.08, 'square', 0.1);
      } else if (ev === 'tile-break' || ev === 'tile-burn') {
        tone(210, 85, 0.14, 'square', 0.12);
      } else if (ev === 'block-push') {
        tone(130, 105, 0.11, 'triangle', 0.12);
      } else if (ev === 'door-unlock' || ev === 'room-solved') {
        tone(523, 659, 0.11, 'triangle', 0.15, 0);
        tone(659, 784, 0.14, 'triangle', 0.15, 0.09);
        tone(784, 1046, 0.2, 'triangle', 0.16, 0.18);
      } else if (ev.startsWith('pickup-')) {
        tone(587, 784, 0.1, 'sine', 0.15, 0);
        tone(880, 1175, 0.2, 'sine', 0.16, 0.09);
      } else if (ev === 'enemy-hit' || ev === 'enemy-defeat') {
        tone(360, 180, 0.1, 'square', 0.12);
      } else if (ev === 'player-hurt') {
        tone(240, 110, 0.2, 'sawtooth', 0.18);
      }
    },
  };
}

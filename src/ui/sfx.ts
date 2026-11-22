/**
 * Lightweight Web Audio synthesized SFX for crisp tactile feedback on rolls,
 * bombs, switches, braziers, keys, and boss phases.
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
      if (ev === 'player-roll') {
        tone(190, 420, 0.09, 'triangle', 0.13, 0);
        tone(420, 210, 0.11, 'sine', 0.09, 0.06);
      } else if (ev === 'bomb-lift') {
        tone(260, 480, 0.065, 'sine', 0.13, 0);
        tone(480, 620, 0.05, 'triangle', 0.09, 0.035);
      } else if (ev === 'bomb-drop') {
        tone(240, 140, 0.07, 'sine', 0.12);
      } else if (ev === 'bomb-throw') {
        tone(280, 520, 0.1, 'triangle', 0.13);
      } else if (ev === 'bomb-bounce') {
        tone(210, 320, 0.055, 'triangle', 0.11, 0);
        tone(150, 95, 0.06, 'sine', 0.1, 0.01);
      } else if (ev === 'bomb-kick') {
        tone(160, 75, 0.055, 'square', 0.12, 0);
        tone(260, 410, 0.07, 'triangle', 0.12, 0.015);
      } else if (ev === 'bomb-shove') {
        tone(190, 90, 0.09, 'sawtooth', 0.13, 0);
        tone(380, 540, 0.08, 'triangle', 0.11, 0.02);
      } else if (ev === 'bomb-splash') {
        tone(290, 130, 0.075, 'sine', 0.12, 0);
        tone(360, 680, 0.085, 'sine', 0.11, 0.05);
      } else if (ev === 'bomb-swallow') {
        tone(420, 95, 0.16, 'sine', 0.12, 0);
        tone(180, 55, 0.12, 'triangle', 0.09, 0.05);
      } else if (ev === 'boom-bomb') {
        tone(150, 38, 0.24, 'sawtooth', 0.22);
        tone(95, 28, 0.28, 'square', 0.14);
      } else if (ev === 'boom-fire') {
        tone(340, 110, 0.22, 'sawtooth', 0.18);
        tone(620, 260, 0.18, 'triangle', 0.12, 0.03);
      } else if (ev === 'crystal-flip') {
        tone(587, 880, 0.14, 'sine', 0.15);
      } else if (ev === 'portal-warp') {
        tone(440, 880, 0.12, 'sine', 0.14, 0);
        tone(660, 1320, 0.14, 'triangle', 0.13, 0.06);
        tone(880, 1760, 0.18, 'sine', 0.14, 0.12);
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
      } else if (ev === 'enemy-notice') {
        tone(520, 780, 0.055, 'square', 0.1, 0);
        tone(780, 1040, 0.075, 'triangle', 0.12, 0.05);
      } else if (ev === 'enemy-windup') {
        tone(220, 460, 0.13, 'sawtooth', 0.11, 0);
        tone(330, 660, 0.11, 'triangle', 0.1, 0.03);
      } else if (ev === 'enemy-stumble') {
        tone(340, 170, 0.08, 'triangle', 0.12, 0);
        tone(240, 115, 0.1, 'sine', 0.11, 0.065);
      } else if (ev === 'flame-snuff') {
        tone(480, 120, 0.12, 'sawtooth', 0.1, 0);
        tone(260, 80, 0.14, 'triangle', 0.11, 0.02);
      } else if (ev === 'slime-split') {
        tone(280, 560, 0.065, 'sine', 0.13, 0);
        tone(380, 740, 0.075, 'sine', 0.12, 0.055);
      } else if (ev === 'shielder-kick') {
        tone(180, 85, 0.06, 'square', 0.13, 0);
        tone(310, 490, 0.075, 'triangle', 0.12, 0.02);
      } else if (ev === 'wind-gust') {
        tone(210, 430, 0.14, 'sine', 0.09, 0);
        tone(430, 190, 0.18, 'triangle', 0.08, 0.1);
      } else if (ev === 'player-hurt') {
        tone(240, 110, 0.2, 'sawtooth', 0.18);
      }
    },
  };
}

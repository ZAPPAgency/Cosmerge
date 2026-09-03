// Godspark - synthesized audio (Web Audio API only, zero external files)
"use strict";

let audioCtx = null;
// Shared final stage EVERY sound (SFX beeps/sweeps and the music pad alike)
// routes through, instead of connecting straight to ctx.destination. Without
// this, muting on background only ever reached the music pad (see
// MusicService below) - any SFX whose decay was still in flight right as the
// app closed (e.g. the click sound from the very tap that triggered closing
// it) had no mute point at all, which is what the residual "dull thud" on
// close was actually coming from even after the pad-only fix.
let masterOutGain = null;
function ensureAudio() {
  const wasUnset = !audioCtx;
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* noop */ }
  }
  if (audioCtx && !masterOutGain) {
    masterOutGain = audioCtx.createGain();
    masterOutGain.gain.value = 1;
    masterOutGain.connect(audioCtx.destination);
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  // Mobile browsers only allow audio (including our generative music) to
  // start from a real user gesture - this is that first gesture.
  // (Storage Access is requested separately, before boot - see main.js.)
  if (wasUnset && window.Game && Game.settings.music) MusicService.start();
  return audioCtx;
}

// Called from main.js on visibilitychange: ramps the single shared output
// gain to 0 (covers SFX and music together) so nothing is left mid-envelope
// at a non-zero amplitude for the OS to cut off abruptly when it tears down
// audio for a backgrounded/closed app - that discontinuity is the click/thud.
let suspendTimer = null;
function muteAllAudio() {
  if (!audioCtx || !masterOutGain) return;
  const now = audioCtx.currentTime;
  masterOutGain.gain.cancelScheduledValues(now);
  masterOutGain.gain.setValueAtTime(masterOutGain.gain.value, now);
  masterOutGain.gain.linearRampToValueAtTime(0, now + 0.04);
  // Beyond muting our own graph: proactively suspending the AudioContext
  // once silent stops the render thread on our terms, before the OS forces
  // the issue by tearing down the audio session on its own - which on iOS
  // can itself produce a route-change pop independent of anything a gain
  // node controls (the "unplugging a cable" sound). This can't be fully
  // ruled out from JS since it happens at the OS/WebKit layer, but ending
  // the session cleanly while already silent is the best mitigation available.
  if (suspendTimer) clearTimeout(suspendTimer);
  suspendTimer = setTimeout(() => {
    if (audioCtx && audioCtx.state === "running") audioCtx.suspend();
  }, 90);
}
function unmuteAllAudio() {
  if (suspendTimer) { clearTimeout(suspendTimer); suspendTimer = null; }
  if (!audioCtx || !masterOutGain) return;
  if (audioCtx.state === "suspended") audioCtx.resume();
  const now = audioCtx.currentTime;
  masterOutGain.gain.cancelScheduledValues(now);
  masterOutGain.gain.setValueAtTime(1, now);
}

function beep(freq, dur, type, vol) {
  if (!Game.settings.sound) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (dur || 0.2));
  osc.connect(gain); gain.connect(masterOutGain);
  osc.start(); osc.stop(ctx.currentTime + (dur || 0.2));
}

function chime(freqs, gap, type, vol) {
  freqs.forEach((f, i) => setTimeout(() => beep(f, 0.18, type, vol), i * gap));
}

// Pitch-glide from freqFrom to freqTo over dur seconds - used for the merge
// sound's "converging" whoosh, distinct from the flat beeps used elsewhere.
function sweep(freqFrom, freqTo, dur, type, vol) {
  if (!Game.settings.sound) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.setValueAtTime(freqFrom, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freqTo, ctx.currentTime + dur);
  gain.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(gain); gain.connect(masterOutGain);
  osc.start(); osc.stop(ctx.currentTime + dur);
}

// Short burst of filtered white noise - the raw material for anything that
// needs to sound physical/textured rather than tonal (impacts, explosions,
// rocky crackle), which pure oscillators (beep/sweep) can't produce.
function noiseBurst(dur, filterType, freqFrom, freqTo, vol) {
  if (!Game.settings.sound) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType || "lowpass";
  filter.frequency.setValueAtTime(freqFrom, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 20), ctx.currentTime + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  noise.connect(filter); filter.connect(gain); gain.connect(masterOutGain);
  noise.start(); noise.stop(ctx.currentTime + dur);
}

// Ascending run used for the merge-streak reward chime in Sfx.meteorImpact -
// a pleasant major-key climb (no dissonant steps) so it stays satisfying
// even at the top of a long combo instead of turning shrill/random.
const COMBO_NOTES = [523.25, 587.33, 659.25, 739.99, 830.61, 932.33, 1046.5, 1174.66];

const Sfx = {
  click() { beep(920, 0.05, "sine", 0.035); },
  // A quick rising whoosh (two tiles converging) followed by a bright two-note
  // chime (the pop of becoming one) - deliberately distinct from tap/click,
  // and scales up a little with tier so late-game fusions feel more powerful.
  // No longer wired to the default merge (see meteorImpact below), kept
  // around as a candidate for a future "classic"/alternate merge-style
  // option once several visual effects can be picked between.
  merge(newTier) {
    const base = 220 + newTier * 18;
    sweep(base * 0.55, base * 1.7, 0.15, "sine", 0.085);
    setTimeout(() => chime([base * 1.7, base * 2.5], 55, "triangle", 0.08), 140);
  },
  // Merge impact sound (paired with playMeteorMerge() in ui.js): a very
  // short whoosh-in, then a punchy pitched "pop" + a brief crack of rocky
  // texture on landing, then a bright rising note. Kept SHORT and snappy on
  // purpose - this fires on every merge, often several per second, so it
  // has to feel like an instant reaction to the tap, never a delay. The
  // 110ms wait before the pop MUST stay in sync with METEOR_FALL_MS in
  // ui.js and the meteorFall CSS animation in style.css.
  //
  // `streak` (0+, see MERGE_STREAK_WINDOW_MS in input.js) walks the reward
  // note up COMBO_NOTES each time merges land back to back, the same trick
  // Candy Crush/Two Dots-style combo chimes use - chaining merges quickly
  // is what should feel the most addictive, so it's the one thing that
  // audibly escalates instead of repeating identically every time.
  meteorImpact(newTier, streak) {
    // Loris (challenging the previous version, correctly): the overall
    // punch/volume was scaling with STREAK (merge speed), but the VISUAL
    // effect (playMeteorMerge, ui.js) already scales with TIER per Noah's
    // original note ("de plus en plus fort en fonction du niveau de merge,
    // pas de la vitesse") - so sound and visual were escalating on two
    // different axes, which could mismatch (a huge tier-8 merge landing
    // with a quiet sound because it happened slowly, or a tiny tier-1
    // merge sounding huge because it was hit #5 in a fast chain). `boost`
    // is now tier-led, with streak kept as a much smaller accent rather
    // than the main driver. The COMBO_NOTES reward-chime melody itself
    // still climbs with streak, untouched - Loris specifically liked that
    // part and it's a separate concern from overall loudness/punch.
    const t = Math.min(newTier, 10);
    const s = Math.min(streak || 0, 6);
    const boost = 1 + (t - 1) * 0.19 + s * 0.05; // tier1/streak0 ~1x, tier10/streak6 ~2.75x
    noiseBurst(0.05, "bandpass", 2800, 1000, Math.min(0.045 * boost, 0.11));
    setTimeout(() => {
      const swing = 1 + (t - 1) * 0.07 + s * 0.03; // pitch swing now widens mainly with tier
      sweep(520 + t * 9, (200 + t * 6) / swing, 0.09, "triangle", Math.min(0.12 * boost, 0.28));
      noiseBurst(0.07, "lowpass", 1800, 280, Math.min(0.07 * boost, 0.17));
      noiseBurst(0.05, "highpass", 2200 * swing, 3200 * swing, Math.min(0.02 * boost, 0.05));
      const note = COMBO_NOTES[Math.min(streak || 0, COMBO_NOTES.length - 1)];
      setTimeout(() => chime([note, note * 1.19], 45, "triangle", Math.min(0.065 * boost, 0.15)), 40);
    }, 110);
  },
  tap() { beep(700, 0.08, "square", 0.04); },
  spawn() { beep(500, 0.12, "sine", 0.05); },
  error() { beep(140, 0.18, "sawtooth", 0.05); },
  unlock() { beep(880, 0.25, "sine", 0.07); },
  purchase() { chime([520, 780, 1040], 70, "sine", 0.06); },
  bigBang() { chime([80, 160, 320, 640, 960], 90, "sawtooth", 0.09); },
  chest() { chime([440, 660, 880], 90, "triangle", 0.07); },
  // One "tick" of the prize wheel passing a peg - short and clicky (square
  // wave reads as mechanical rather than musical), slight pitch jitter so a
  // long run of them doesn't sound like a machine-gun. See scheduleWheelTicks
  // in input.js, which calls this repeatedly at a decelerating rate for the
  // whole spin - previously the wheel spun in total silence.
  wheelTick() { beep(880 + Math.random() * 220, 0.035, "square", 0.045); },
  // A proper little win fanfare for landing on a wheel prize (Loris found
  // reusing Sfx.chest() - the same sound as the daily-login chest - too
  // easy to miss/not register as "the wheel specifically paid out"). A
  // brighter, longer ascending run than chest()'s plain 3-note triad, with
  // a quick high sparkle flourish tacked on at the end.
  wheelWin() {
    chime([523.25, 659.25, 783.99, 1046.5], 65, "triangle", 0.075);
    setTimeout(() => chime([1318.5, 1568], 45, "sine", 0.05), 260);
  },
  quest() { chime([660, 880], 90, "sine", 0.06); },
};

// Generative ambient pad - upbeat major-key progression (I-V-vi-IV), quiet
// and non-intrusive, entirely synthesized (no audio files). Deliberately
// avoids a low, minor-key drone (reads as sad/tense) in favor of a brighter
// register that still feels calm rather than childish.
const MusicService = (function () {
  let masterGain = null;
  let running = false;
  let timer = null;
  let sparkleTimer = null;
  let chordIndex = 0;
  const CHORD_DURATION_S = 8;
  const CHORDS = [
    [261.63, 329.63, 392.00],  // C4 E4 G4 - C major
    [196.00, 246.94, 293.66],  // G3 B3 D4 - G major
    [220.00, 261.63, 329.63],  // A3 C4 E4 - A minor (brief passing chord, not the tonic)
    [174.61, 220.00, 261.63],  // F3 A3 C4 - F major
  ];
  const SPARKLE_NOTES = [523.25, 659.25, 783.99, 880.00]; // C5 E5 G5 A5 - stays inside the current key

  function playChord(freqs, durationS) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const chordGain = ctx.createGain();
    const now = ctx.currentTime;
    chordGain.gain.setValueAtTime(0, now);
    chordGain.gain.linearRampToValueAtTime(1, now + 2);
    chordGain.gain.linearRampToValueAtTime(0, now + durationS);
    chordGain.connect(masterGain);
    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f * (1 + (Math.random() - 0.5) * 0.003); // tiny detune, avoids a sterile/robotic pad
      osc.connect(chordGain);
      osc.start(now);
      osc.stop(now + durationS + 0.1);
    });
  }

  function playSparkle() {
    if (!running || !Game.settings.music) return;
    const ctx = ensureAudio();
    if (ctx) {
      const note = SPARKLE_NOTES[Math.floor(Math.random() * SPARKLE_NOTES.length)];
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.6, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      gain.connect(masterGain);
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = note;
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 1.5);
    }
    sparkleTimer = setTimeout(playSparkle, 5000 + Math.random() * 6000);
  }

  function scheduleNext() {
    if (!running) return;
    playChord(CHORDS[chordIndex % CHORDS.length], CHORD_DURATION_S);
    chordIndex++;
    timer = setTimeout(scheduleNext, (CHORD_DURATION_S - 1.5) * 1000);
  }

  const MASTER_LEVEL = 0.026; // quiet ambience, well under the SFX

  return {
    start() {
      if (running) return;
      const ctx = ensureAudio();
      if (!ctx) return;
      if (!masterGain) {
        masterGain = ctx.createGain();
        masterGain.gain.value = MASTER_LEVEL;
        masterGain.connect(masterOutGain); // shared final mute point - see muteAllAudio() above
      }
      running = true;
      scheduleNext();
      sparkleTimer = setTimeout(playSparkle, 4000);
    },
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
      if (sparkleTimer) clearTimeout(sparkleTimer);
      timer = null; sparkleTimer = null;
    },
    setEnabled(on) { if (on) this.start(); else this.stop(); },
  };
})();

// Global settings reference filled by main.js at boot (Game = window.Game)
window.Game = window.Game || { settings: { sound: true, music: true } };

// HapticService: no-op on web; the same call sites are ready for
// Capacitor's Haptics plugin (impact/notification) once wrapped natively.
const HapticService = {
  impact(type) { /* type: 'light' | 'medium' | 'heavy' | 'success' — no-op on web */ },
};

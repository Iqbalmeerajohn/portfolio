/* Iqbal.OS sound design. Everything is synthesized live with WebAudio:
   no audio files, no licensing, nothing plays until the visitor clicks.

   Key: D major. Each chapter has its own chord; moving between chapters
   crossfades a warm string-like pad, plays a soft electric-piano phrase,
   and brushes an airy whoosh. Scrubbing the particles drops small wooden
   balls: each lands with a soft thock and bounces to rest, tuned low to the
   current chapter's chord so it sits inside the music. */

const midi = n => 440 * Math.pow(2, (n - 69) / 12);
// one chord per chapter, in chapter order
const CHORDS = [
  [50, 57, 61, 64, 66], // intro      Dmaj9
  [47, 54, 57, 61, 62], // manifesto  Bm9
  [43, 50, 54, 57, 59], // saree      Gmaj9
  [45, 52, 54, 59, 61], // salvage    A6/9
  [40, 47, 50, 54, 55], // gummy      Em9
  [42, 49, 52, 57, 61], // voice      F#m7
  [43, 50, 54, 59, 61], // kafa       Gmaj7#11
  [50, 54, 57, 64, 66], // chompy     Dadd9
  [47, 54, 57, 62, 64], // journey    Bm11
  [38, 45, 52, 54, 61]  // contact    Dmaj9 (low, resolved)
];
const MOTIF = [74, 81, 90];                             // D5 A5 F#6: the signature

export function createAudio(opts = {}) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const S = { ctx: null, on: false, chapter: -1, pad: [], lastTick: 0 };
  if (!AC) return { supported: false, start() { return false; }, setOn() {}, chapter() {}, scroll() {}, scrub() {}, intro() {}, hover() {}, get on() { return false; } };

  let ctx, master, comp, verb, verbIn, dry, airGain, airFilter, airPan;

  function impulse(seconds, decay) {
    const len = Math.round(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function build() {
    ctx = S.ctx = opts.context || new AC({ latencyHint: "interactive" });
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = .01; comp.release.value = .3;
    master = ctx.createGain(); master.gain.value = 0;
    dry = ctx.createGain(); dry.gain.value = 1;
    verb = ctx.createConvolver(); verb.buffer = impulse(3.4, 2.6);
    verbIn = ctx.createGain(); verbIn.gain.value = 1;
    const verbOut = ctx.createGain(); verbOut.gain.value = .55;
    dry.connect(comp); verbIn.connect(verb); verb.connect(verbOut); verbOut.connect(comp);
    comp.connect(master); master.connect(ctx.destination);

    // scroll "air": soft noise whose loudness and brightness follow scroll speed
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(4); n.loop = true;
    airFilter = ctx.createBiquadFilter(); airFilter.type = "bandpass"; airFilter.frequency.value = 500; airFilter.Q.value = .8;
    airPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    airGain = ctx.createGain(); airGain.gain.value = 0;
    n.connect(airFilter);
    if (airPan) { airFilter.connect(airPan); airPan.connect(airGain); } else airFilter.connect(airGain);
    airGain.connect(dry); airGain.connect(verbIn);
    n.start();
  }

  function noiseBuf(sec) {
    const len = ctx.sampleRate * sec, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    // gentle pink-ish noise (Paul Kellet's economy filter)
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * .1848) * .11;
    }
    return b;
  }

  const out = (node, wet = .4) => {
    const w = ctx.createGain(); w.gain.value = wet;
    node.connect(dry); node.connect(w); w.connect(verbIn);
  };
  const pan = (node, p) => { if (!ctx.createStereoPanner) return node; const s = ctx.createStereoPanner(); s.pan.value = p; node.connect(s); return s; };

  /* warm pad: two detuned saws per note through a soft low-pass */
  function padChord(notes, when, fade = 2.4) {
    const t = when ?? ctx.currentTime;
    const old = S.pad; S.pad = [];
    old.forEach(v => { v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0, t + fade); v.oscs.forEach(o => o.stop(t + fade + .1)); });
    notes.forEach((m, i) => {
      const f = midi(m), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 520 + i * 90; lp.Q.value = .5;
      const oscs = [-7, 6].map(det => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det + (Math.random() - .5) * 3; o.connect(lp); o.start(t); return o; });
      lp.connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.022 - i * .002, t + fade * .9);
      out(pan(g, (i / (notes.length - 1) - .5) * .7), .75);
      S.pad.push({ g, oscs });
    });
  }

  /* electric-piano tone: sine carrier with a decaying FM "tine" */
  function keys(m, t, vel = .5, p = 0) {
    const f = midi(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * 1;
    mg.gain.setValueAtTime(f * 1.6 * vel, t); mg.gain.exponentialRampToValueAtTime(f * .08, t + .9);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09 * vel, t + .008); g.gain.exponentialRampToValueAtTime(.0005, t + 2.6);
    out(pan(g, p), .5);
    car.start(t); mod.start(t); car.stop(t + 2.7); mod.stop(t + 2.7);
  }

  /* bell: bright FM with an inharmonic ratio, used for the signature motif */
  function bell(m, t, vel = .5, p = 0) {
    const f = midi(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 2.2 * vel, t); mg.gain.exponentialRampToValueAtTime(f * .02, t + 1.6);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.07 * vel, t + .004); g.gain.exponentialRampToValueAtTime(.0004, t + 3.2);
    out(pan(g, p), .65);
    car.start(t); mod.start(t); car.stop(t + 3.3); mod.stop(t + 3.3);
  }

  /* a dot as a small ball dropping on a wooden floor */
  let clickBuf = null;
  let landing = []; // audio-clock times when each ball in the air comes to rest
  function thock(t, amp, p, f) {
    if (!clickBuf) {
      const len = Math.round(ctx.sampleRate * .02); clickBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = clickBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    // body: a short tone that drops in pitch, like a ball deforming on impact
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(f * 1.8, t); o.frequency.exponentialRampToValueAtTime(f, t + .018);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.38 * amp, t + .0015); g.gain.exponentialRampToValueAtTime(.0004, t + .075 + amp * .05);
    o.connect(g);
    // contact: a tiny dull click from the floor
    const n = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = clickBuf; lp.type = "lowpass"; lp.frequency.value = 1400 + amp * 1800;
    ng.gain.setValueAtTime(.24 * amp, t); ng.gain.exponentialRampToValueAtTime(.0005, t + .012);
    n.connect(lp); lp.connect(ng);
    const mix = ctx.createGain(); g.connect(mix); ng.connect(mix);
    out(pan(mix, p), .16);
    o.start(t); o.stop(t + .16); n.start(t); n.stop(t + .02);
  }
  function ball(t, vel, p, m) {
    landing = landing.filter(e => e > ctx.currentTime);
    if (landing.length > 18) return;
    const f = midi(m);
    let dt = .13 + Math.random() * .09, amp = vel, when = t;
    const bounces = 3 + (Math.random() * 2 | 0);
    for (let i = 0; i < bounces; i++) {
      // each bounce: a touch higher (the ball stiffens), sooner and quieter
      thock(when, amp, p + (Math.random() - .5) * .08, f * (1 + i * .015));
      when += dt; dt *= .6; amp *= .5;
    }
    landing.push(when);
  }
  // pick a low note from the current chapter's chord
  const ballNote = () => { const ch = CHORDS[S.chapter] || CHORDS[0]; return ch[1 + (Math.random() * (ch.length - 1) | 0)] + (Math.random() < .5 ? 0 : 12); };

  function whoosh(t, dur = 1.1, up = true, p = 0) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(dur + .1);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(up ? 250 : 2600, t); bp.frequency.exponentialRampToValueAtTime(up ? 2600 : 300, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.24, t + dur * .55); g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(bp); bp.connect(g); out(pan(g, p), .6); src.start(t); src.stop(t + dur + .1);
  }

  function boom(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(34, t + 1.2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.5, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + 1.6);
    o.connect(g); out(g, .3); o.start(t); o.stop(t + 1.7);
  }

  function riser(t, dur) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(dur + .2);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 4;
    lp.frequency.setValueAtTime(200, t); lp.frequency.exponentialRampToValueAtTime(5000, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.22, t + dur * .95); g.gain.linearRampToValueAtTime(0, t + dur + .08);
    src.connect(lp); lp.connect(g); out(g, .5); src.start(t); src.stop(t + dur + .2);
  }

  const api = {
    supported: true,
    get on() { return S.on; },
    /* must be called from a click or tap */
    start() {
      try { if (!ctx) build(); if (!opts.context) ctx.resume(); } catch (e) { return false; }
      S.on = true;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(.85, ctx.currentTime, .3);
      if (!S.pad.length && S.chapter >= 0) padChord(CHORDS[S.chapter]);
      return true;
    },
    setOn(v) {
      if (v) return api.start();
      S.on = false;
      if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, .25);
      return true;
    },
    /* the entrance: swell as the curtain splits, boom and shimmer on the burst, then the motif */
    intro(burstAt = .9) {
      if (!S.on) return;
      const t = ctx.currentTime + .02, b = t + burstAt;
      riser(t, burstAt);
      boom(b);
      whoosh(b, 1.6, false, 0);
      S.chapter = 0; padChord(CHORDS[0], b, 2.2);
      // the burst: a shower of balls that thins out as the dots settle into the name
      for (let i = 0; i < 16; i++) { const k = i / 16; ball(b + .05 + k * k * 1.9 + Math.random() * .05, .85 * (1 - k * .6), (Math.random() - .5) * 1.6, CHORDS[0][1 + (i % 4)] + (i % 3 === 0 ? 12 : 0)); }
      MOTIF.forEach((m, i) => bell(m, b + 1.1 + i * .32, .7, (i - 1) * .35));
    },
    /* chapter change: new chord, a short piano phrase, a brush of air */
    chapter(i) {
      if (i === S.chapter) return;
      const prev = S.chapter; S.chapter = i;
      if (!S.on || !ctx) return;
      const t = ctx.currentTime, ch = CHORDS[i] || CHORDS[0], down = prev > i;
      padChord(ch, t, 2.4);
      whoosh(t, .95, !down, down ? .3 : -.3);
      const up = ch.slice(1).map(n => n + 12);
      up.forEach((n, k) => keys(n, t + .28 + k * .11, .45 - k * .05, (k - 1.5) * .25));
      if (i === CHORDS.length - 1) MOTIF.forEach((m, k) => bell(m, t + 1 + k * .32, .6, (k - 1) * .35));
    },
    /* continuous: v = scroll speed in px per frame (signed) */
    scroll(v) {
      if (!S.on || !ctx) return;
      const s = Math.min(1, Math.abs(v) / 40), t = ctx.currentTime;
      airGain.gain.setTargetAtTime(s * s * .18, t, .12);
      airFilter.frequency.setTargetAtTime(400 + s * 2200, t, .15);
      if (airPan) airPan.pan.setTargetAtTime(Math.max(-.5, Math.min(.5, v / 60)), t, .2);
    },
    /* scrubbing particles: speed in px since last move, x in 0..1 across the screen */
    scrub(speed, x) {
      if (!S.on || !ctx) return;
      const now = ctx.currentTime;
      if (now - S.lastTick < .06) return;
      S.lastTick = now;
      // faster movement knocks more balls loose: up to 2, dropped here and there
      const count = Math.min(2, 1 + Math.floor(speed / 26)), p = (x - .5) * 1.6;
      for (let k = 0; k < count; k++)
        ball(now + Math.random() * .12, .45 + Math.random() * .45, p + (Math.random() - .5) * .6, ballNote());
    },
    hover() {
      if (!S.on || !ctx) return;
      const t = ctx.currentTime;
      thock(t, .35, 0, midi(ballNote()));
    },
    suspend() { ctx?.suspend(); },
    resume() { if (S.on) ctx?.resume(); }
  };
  return api;
}

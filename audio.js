/* Iqbal.OS sound design. Everything is synthesized live with WebAudio:
   no audio files, no licensing, nothing plays until the visitor clicks.

   Key: D major. Each chapter has its own chord; moving between chapters
   crossfades a warm string-like pad, plays a soft electric-piano phrase,
   and brushes an airy whoosh. Scrubbing the particles releases tiny
   unpitched grains, like sand or rain, so it sounds like the dots look. */

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

  /* particle grain: a few milliseconds of band-passed noise, no pitch.
     Many of them in a row sound like fine sand or rain scattering, which
     is what the dots look like when you push through them. */
  let grainBuf = null;
  function grain(t, vel, p, bright = 1) {
    if (!grainBuf) {
      const len = Math.round(ctx.sampleRate * .06); grainBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = grainBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource(); src.buffer = grainBuf;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass";
    bp.frequency.value = (1800 + Math.random() * 5200) * bright; bp.Q.value = 1.5 + Math.random() * 4;
    const g = ctx.createGain(), len = .006 + Math.random() * .024;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.34 * vel, t + .0012); g.gain.exponentialRampToValueAtTime(.0004, t + len);
    src.connect(bp); bp.connect(g); out(pan(g, p), .22);
    src.start(t, Math.random() * .03); src.stop(t + len + .01);
    // now and then a faint soft "tock" underneath, so the texture has weight
    if (Math.random() < .22) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.setValueAtTime(160 + Math.random() * 140, t); o.frequency.exponentialRampToValueAtTime(90, t + .04);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(.05 * vel, t + .002); og.gain.exponentialRampToValueAtTime(.0003, t + .05);
      o.connect(og); out(pan(og, p * .5), .1); o.start(t); o.stop(t + .06);
    }
  }

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
      // the burst: a spray of grains that thins out as the dots settle into the name
      for (let i = 0; i < 70; i++) { const k = i / 70; grain(b + .02 + k * k * 2.2 + Math.random() * .04, .9 * (1 - k * .8), (Math.random() - .5) * 1.8, 1.2 - k * .4); }
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
      if (now - S.lastTick < .014) return;
      S.lastTick = now;
      // faster movement disturbs more dots: up to 7 grains, scattered over the next 90ms
      const count = Math.min(7, 1 + Math.floor(speed / 7)), p = (x - .5) * 1.6;
      for (let k = 0; k < count; k++)
        grain(now + Math.random() * .09, .3 + Math.random() * .6, p + (Math.random() - .5) * .5, .8 + Math.min(.6, speed / 120));
    },
    hover() {
      if (!S.on || !ctx) return;
      const t = ctx.currentTime;
      grain(t, .35, 0, 1.1); grain(t + .018, .2, 0, 1.3);
    },
    suspend() { ctx?.suspend(); },
    resume() { if (S.on) ctx?.resume(); }
  };
  return api;
}

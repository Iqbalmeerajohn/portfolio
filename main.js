import * as THREE from "three";
import { createAudio } from "./audio.js?v=d75e5fab3d";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const mobile = matchMedia("(max-width: 900px)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;
const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
// tier 0 = phone / weak device, 1 = tablet, 2 = laptop / desktop
const TIER = mobile || (coarse && weak) ? 0 : coarse || weak ? 1 : 2;
document.documentElement.classList.add("tier-" + TIER);
ScrollTrigger.config({ ignoreMobileResize: true });
gsap.registerPlugin(ScrollTrigger);
const EASE = "expo.out";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* =====================================================================
   BOOT: counter + system log follow real loading
   ===================================================================== */
const boot = { target: 0, shown: 0, live: true };
const bootNum = $("#bootNum"), bootBar = $("#bootBar"), logLines = $$("#bootLog li");
const TASKS = 6; let done = 0;
const tick = () => { done++; boot.target = Math.max(boot.target, done / TASKS); };
gsap.ticker.add(() => {
  if (!boot.live) return;
  boot.shown += (boot.target - boot.shown) * 0.07;
  if (boot.target === 1 && boot.shown > .995) boot.shown = 1;
  bootNum.textContent = String(Math.round(boot.shown * 100)).padStart(3, "0");
  bootBar.style.transform = `scaleX(${boot.shown})`;
  logLines.forEach(li => {
    if (!li.classList.contains("in") && boot.shown >= +li.dataset.at) {
      li.classList.add("in"); setTimeout(() => li.classList.add("ok"), 260);
    }
  });
});
const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => { tick(); res(i); }; i.onerror = () => { tick(); res(null); }; i.src = src; });
const fontsReady = (document.fonts ? document.fonts.ready : Promise.resolve())
  .then(() => Promise.all([document.fonts?.load?.('700 100px "Clash Display"')]).catch(() => {})).then(tick);

/* =====================================================================
   SMOOTH SCROLL
   ===================================================================== */
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new Lenis({ lerp: 0.085 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
let anchors = [];
$$('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
  const id = a.getAttribute("href"); if (id.length < 2) return;
  e.preventDefault();
  const el = $(id);
  const y = el.dataset.scene && anchors.length ? anchors[+el.dataset.scene] : el.getBoundingClientRect().top + scrollY;
  lenis ? lenis.scrollTo(y, { duration: 1.8 }) : scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
}));

/* =====================================================================
   PARTICLE SCENES (normalised: longest side = 1, centred)
   ===================================================================== */
const N = [6000, 10000, 16000][TIER];
const PR_MAX = [1.25, 1.5, 1.75][TIER];
document.querySelectorAll(".pcount").forEach(el => { el.textContent = N.toLocaleString("en-US"); });
const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const BONE = hex("#ece8dc"), MARI = hex("#f2b134");
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sat = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
const lumOf = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
// portrait colours: skin keeps its warmth, the black shirt and hair lift to a visible slate
const SLATE = [.36, .43, .62], BONE_P = [.93, .91, .86];
function portraitColor(r, g, b) {
  const lum = lumOf(r, g, b), s = sat(r, g, b);
  if (r > b + .04 && s > .18) return [Math.min(1, r * 1.4 + .06), Math.min(1, g * 1.35 + .05), Math.min(1, b * 1.3 + .05)];
  const v = (.42 + .58 * Math.pow(lum, .7)) * 1.55;
  return mixc(SLATE, BONE_P, lum).map(c => Math.min(1, c * v));
}
const boost = (r, g, b) => [Math.min(1, r * 1.25 + .07), Math.min(1, g * 1.25 + .07), Math.min(1, b * 1.25 + .07)];

function fromCandidates(cand, step, zDepth, colorOf) {
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let i = 0; i < cand.length; i += 5) { const x = cand[i], y = cand[i + 1]; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, span = Math.max(maxX - minX, maxY - minY) || 1;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), k = cand.length / 5;
  for (let i = 0; i < N; i++) {
    const j = (Math.random() * k | 0) * 5;
    const x = cand[j] + (Math.random() - .5) * step, y = cand[j + 1] + (Math.random() - .5) * step;
    const c = colorOf(cand[j + 2], cand[j + 3], cand[j + 4], (y - minY) / (maxY - minY || 1));
    pos[i * 3] = (x - cx) / span; pos[i * 3 + 1] = -(y - cy) / span;
    pos[i * 3 + 2] = (lumOf(...c) - .5) * zDepth + (Math.random() - .5) * 0.02;
    col.set(c, i * 3);
  }
  return { pos, col };
}
function textScene(txt) {
  const W = 1600, H = 460, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.font = `700 330px "Clash Display", "Satoshi", sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText(txt, W / 2, H / 2 + 10);
  const d = g.getImageData(0, 0, W, H).data, cand = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 128) cand.push(x, y, 0, 0, 0);
  return fromCandidates(cand, 2, 0, () => Math.random() < .16 ? MARI : mixc(BONE, [1, 1, 1], Math.random() * .3));
}
function imageScene(img, sampleW, keep, colorFn, weight, depth = .12) {
  const w = sampleW, h = Math.round(sampleW * img.naturalHeight / img.naturalWidth);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, cand = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, a = d[i + 3] / 255;
    if (!keep(r, gg, b, a, x / w, y / h)) continue;
    const reps = weight ? weight(x / w, y / h) : 1;
    for (let k = 0; k < reps; k++) cand.push(x, y, r, gg, b);
  }
  return fromCandidates(cand, 1, depth, colorFn);
}
function build(fn) { const pos = new Float32Array(N * 3), col = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const [p, c] = fn(i); pos.set(p, i * 3); col.set(c, i * 3); } return { pos, col }; }
const rndSphere = r => { const u = Math.random() * 2 - 1, th = Math.random() * 6.283, s = Math.sqrt(1 - u * u); return [Math.cos(th) * s * r, u * r, Math.sin(th) * s * r]; };

const singularity = () => build(() => [rndSphere(.004 * Math.random()), Math.random() < .2 ? MARI : BONE]);
const coreScene = () => { const g = Math.PI * (3 - Math.sqrt(5)); return build(i => {
  if (i < N * .72) { const k = i / (N * .72), y = 1 - k * 2, r = Math.sqrt(1 - y * y), th = g * i; return [[Math.cos(th) * r * .5, y * .5, Math.sin(th) * r * .5], mixc(BONE, MARI, Math.max(0, -y) * .9)]; }
  return [rndSphere(Math.cbrt(Math.random()) * .34), MARI];
}); };
const ringScene = () => build(() => {
  const R = .42;
  if (Math.random() < .58) {
    const s = Math.random() * 9 | 0, gate = s === 3, a = Math.PI / 2 - s * (2 * Math.PI / 9), q = rndSphere((gate ? .085 : .05) * Math.cbrt(Math.random()));
    return [[Math.cos(a) * R + q[0], Math.sin(a) * R + q[1], q[2]], gate ? MARI : BONE];
  }
  const a = Math.random() * 6.283, j = (Math.random() - .5) * .014;
  return [[Math.cos(a) * (R + j), Math.sin(a) * (R + j), (Math.random() - .5) * .014], mixc(BONE, [.36, .41, .52], .6)];
});
const blobScene = () => { const G1 = hex("#34f5b9"), G2 = hex("#0a8a64"); return build(i => {
  if (i < N * .84) {
    const u = Math.random() * 2 - 1, th = Math.random() * 6.283, s = Math.sqrt(1 - u * u), ph = Math.acos(u);
    const rr = .4 * (1 + .1 * Math.sin(3 * th) * Math.sin(2 * ph)) * (i % 4 === 0 ? Math.cbrt(Math.random()) : 1);
    return [[Math.cos(th) * s * rr, u * rr, Math.sin(th) * s * rr], mixc(G1, G2, (1 - u) / 2)];
  }
  const a = Math.random() * 6.283, rr = .56 + (Math.random() - .5) * .03;
  return [[Math.cos(a) * rr, (Math.random() - .5) * .02, Math.sin(a) * rr], mixc(G1, BONE, .5)];
}); };
// MFCC grid: 94 time frames wide, 120 coefficients tall, the model's real input shape
const mfccScene = () => { const C1 = hex("#3b3fb8"), C2 = hex("#18c3d6"); return build(i => {
  const cell = i % (94 * 120), fx = cell % 94, fy = cell / 94 | 0;
  const x = (fx + (Math.random() - .5) * .6) / 93 - .5, y = ((fy + (Math.random() - .5) * .6) / 119 - .5) * .62;
  return [[x, y, 0], mixc(C1, C2, fy / 119)];
}); };
const starScene = () => build(() => [[(Math.random() - .5) * 1.8, (Math.random() - .5) * 1.1, (Math.random() - .7) * 1.2], mixc([.25, .29, .4], Math.random() < .08 ? MARI : BONE, Math.random() * .55)]);

/* =====================================================================
   RENDERER
   ===================================================================== */
const canvas = $("#gl");
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false, depth: false }); renderer.autoClear = false; }
catch (e) { canvas.style.display = "none"; }

const VERT = /* glsl */`
attribute vec3 pA; attribute vec3 pB; attribute vec3 cA; attribute vec3 cB; attribute vec4 rnd;
uniform float uT, uTime, uSize, uPR, uBurst, uSA, uSB, uMouseR, uWA, uWB, uVel;
uniform vec3 uOA, uOB; uniform mat3 uRA, uRB; uniform vec2 uMouse;
varying vec3 vC; varying float vA;
float wave(vec3 p){
  float env = exp(-(p.y + .31) * 3.) * .85 + .15;
  float w = sin(p.x * 18. - uTime * 2.4) * .5 + sin(p.x * 41. + p.y * 9. - uTime * 3.7) * .3 + sin(p.x * 7. + uTime * 1.3) * .45;
  return env * max(0., .45 + .55 * w) * .2;
}
void main(){
  float d = rnd.w * .42;
  float t = smoothstep(d, d + .58, uT);
  float hA = uWA > 0. ? wave(pA) * uWA : 0.;
  float hB = uWB > 0. ? wave(pB) * uWB : 0.;
  vec3 a = uRA * (pA + vec3(0., 0., hA)) * uSA + uOA;
  vec3 b = uRB * (pB + vec3(0., 0., hB)) * uSB + uOB;
  vec3 p = mix(a, b, t);
  float S = mix(uSA, uSB, t);
  float burst = sin(t * 3.14159) * uBurst;
  p += rnd.xyz * burst * S * .75;
  p.xy += vec2(-p.y, p.x) * burst * .25 * (rnd.w - .5);
  p += vec3(sin(uTime * .7 + rnd.w * 40.), cos(uTime * .6 + rnd.w * 31.), sin(uTime * .5 + rnd.w * 17.)) * S * .0035;
  p.y += uVel * S * (.0004 + rnd.w * .0014);
  vec2 dm = p.xy - uMouse; float dist = length(dm);
  float f = smoothstep(uMouseR, 0., dist);
  p.xy += dm / (dist + .001) * f * uMouseR * .55;
  p.z += f * uMouseR * .6;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPR * (.55 + rnd.w * .9) * (1000. / -mv.z) * (1. + burst * .6);
  float heat = mix(hA, hB, t) * 5.;
  vec3 hot = mix(vec3(.95, .69, .2), vec3(1., .35, .45), clamp(heat - .6, 0., 1.));
  vC = mix(mix(cA, cB, t), hot, clamp(heat, 0., 1.)) * (1. + f * .6);
  vA = .6 + .4 * rnd.w;
}`;
const FRAG = /* glsl */`
varying vec3 vC; varying float vA;
void main(){ vec2 c = gl_PointCoord - .5; float r = length(c); if (r > .5) discard; gl_FragColor = vec4(vC, smoothstep(.5, .08, r) * vA); }`;

// background: slow nebula tinted by the current chapter
const BG_FRAG = /* glsl */`
precision highp float;
uniform float uTime; uniform vec3 uTint; uniform vec2 uRes; uniform float uScroll;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a * n(p); p = p * 2.03 + 11.7; a *= .5; } return v; }
void main(){
  vec2 uv = vUv; vec2 p = (uv - .5) * vec2(uRes.x / uRes.y, 1.) * 2.2;
  p.y += uScroll * .6;
  float t = uTime * .045;
  vec2 q = vec2(fbm(p + t), fbm(p - t + 4.2));
  float f = fbm(p + 1.8 * q + vec2(t * 1.6, -t));
  vec3 base = vec3(.027, .043, .086);
  vec3 col = base + uTint * pow(f, 1.5) * 1.9 + vec3(.95, .69, .2) * pow(max(0., f - .58), 2.) * .22;
  col *= 1. - length(uv - .5) * .55;
  gl_FragColor = vec4(col, 1.);
}`;
const BG_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

// far dust for depth and parallax
const DUST_VERT = /* glsl */`
uniform float uPR, uScroll, uTime; attribute float s;
void main(){
  vec3 p = position; p.y = mod(p.y + uScroll * (180. + s * 260.) + 900., 1800.) - 900.;
  p.x += sin(uTime * .1 + s * 30.) * 8.;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1. + s * 1.6) * uPR * (1000. / -mv.z);
}`;
const DUST_FRAG = `void main(){ vec2 c = gl_PointCoord - .5; if (length(c) > .5) discard; gl_FragColor = vec4(.8, .82, .9, .22); }`;

let camera, sceneMain, sceneBg, bgCam, material, geo, bgMat, dustMat, bgRT, sceneBlit, glLost = false;
let prNow = PR_MAX, drawN = N, bgFrame = 0;
if (renderer) {
  camera = new THREE.PerspectiveCamera(35, 1, 10, 5000); camera.position.z = 1000;
  sceneMain = new THREE.Scene(); sceneBg = new THREE.Scene(); bgCam = new THREE.Camera();

  bgMat = new THREE.ShaderMaterial({ vertexShader: BG_VERT, fragmentShader: BG_FRAG, depthTest: false, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uTint: { value: new THREE.Color(0x2a2410) }, uRes: { value: new THREE.Vector2(1, 1) }, uScroll: { value: 0 } } });
  sceneBg.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));
  bgRT = new THREE.WebGLRenderTarget(64, 64, { depthBuffer: false, stencilBuffer: false });
  sceneBlit = new THREE.Scene();
  sceneBlit.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: BG_VERT, fragmentShader: "uniform sampler2D map; varying vec2 vUv; void main(){ gl_FragColor = texture2D(map, vUv); }",
    uniforms: { map: { value: bgRT.texture } }, depthTest: false, depthWrite: false })));
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); glLost = true; canvas.style.opacity = "0"; });
  canvas.addEventListener("webglcontextrestored", () => { glLost = false; canvas.style.opacity = ""; curA = curB = -9; });

  const DN = [500, 1000, 1600][TIER], dpos = new Float32Array(DN * 3), ds = new Float32Array(DN);
  for (let i = 0; i < DN; i++) { dpos.set([(Math.random() - .5) * 2600, (Math.random() - .5) * 1800, -300 - Math.random() * 1500], i * 3); ds[i] = Math.random(); }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3)); dgeo.setAttribute("s", new THREE.BufferAttribute(ds, 1));
  dustMat = new THREE.ShaderMaterial({ vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false,
    uniforms: { uPR: { value: 1 }, uScroll: { value: 0 }, uTime: { value: 0 } } });
  const dust = new THREE.Points(dgeo, dustMat); dust.frustumCulled = false; sceneMain.add(dust);

  geo = new THREE.BufferGeometry();
  const rnd = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { const q = rndSphere(.3 + Math.random() * .7); rnd.set([q[0], q[1], q[2], Math.random()], i * 4); }
  ["pA", "pB", "cA", "cB"].forEach(k => geo.setAttribute(k, new THREE.BufferAttribute(new Float32Array(N * 3), 3)));
  geo.setAttribute("rnd", new THREE.BufferAttribute(rnd, 4));
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uTime: { value: 0 }, uSize: { value: [2.9, 2.7, 2.6][TIER] }, uPR: { value: 1 }, uBurst: { value: reduce ? 0 : 1 },
      uSA: { value: 1 }, uSB: { value: 1 }, uOA: { value: new THREE.Vector3() }, uOB: { value: new THREE.Vector3() },
      uRA: { value: new THREE.Matrix3() }, uRB: { value: new THREE.Matrix3() }, uMouse: { value: new THREE.Vector2(9999, 9999) },
      uMouseR: { value: 0 }, uWA: { value: 0 }, uWB: { value: 0 }, uVel: { value: 0 } } });
  const pts = new THREE.Points(geo, material); pts.frustumCulled = false; sceneMain.add(pts);
}

/* chapter layout: panel side decides which side the shape sits on */
let visW = 1, visH = 1;
const secs = $$("[data-scene]");
const sideOf = i => secs[i]?.dataset.side === "right" ? -1 : 1;
const workOff = (i, k = .2) => mobile ? [0, visH * .18] : [visW * k * sideOf(i), 0];
const cfg = [
  { tint: "#2b2410", scale: () => Math.min(visW * (mobile ? .9 : .62), visH * 2.2), off: () => [0, visH * (mobile ? .2 : .14)], rot: "face", ry: .17 },
  { tint: "#33260a", scale: () => mobile ? visW * .5 : visH * .56, off: () => mobile ? [0, visH * .33] : [visW * .28, visH * .04], rot: "spin" },
  { tint: "#3d0b1c", scale: () => visH * (mobile ? .48 : .86), off: () => workOff(2), rot: "face" },
  { tint: "#2e2508", scale: () => mobile ? visW * .95 : visH * .8, off: () => workOff(3), rot: "ring" },
  { tint: "#07342a", scale: () => mobile ? visW * .78 : visH * .62, off: () => workOff(4, .21), rot: "spin" },
  { tint: "#1d1850", scale: () => mobile ? visW * .95 : visH * .72, off: () => workOff(5, .235), rot: "terrain", wave: 1, ry: .3 },
  { tint: "#3a1a06", scale: () => visH * (mobile ? .42 : .66), off: () => workOff(6), rot: "face" },
  { tint: "#3a0c2a", scale: () => mobile ? Math.min(visW * .95, visH * .45) : visH * .82, off: () => workOff(7), rot: "face" },
  { tint: "#14203f", scale: () => mobile ? visW * .78 : visH * .74, off: () => mobile ? [0, visH * .26] : [visW * .24, visH * .04], rot: "face", ry: .45 },
  { tint: "#2b2410", scale: () => Math.min(visW * (mobile ? .92 : .6), visH * 2.2), off: () => [0, visH * (mobile ? .26 : .22)], rot: "face", ry: .17 }
];
const tints = cfg.map(c => new THREE.Color(c.tint));
const introCfg = { scale: () => visH, off: () => [0, visH * (mobile ? .2 : .14)], rot: "drift" };
let scenes = [], singular = null;

const mouse = { x: 0, y: 0, wx: 9999, wy: 9999, active: 0, nx: 0, ny: 0 };
const euler = new THREE.Euler(), m4 = new THREE.Matrix4();
function rotFor(kind, t, into) {
  const mx = mouse.nx, my = mouse.ny, T = reduce ? 0 : t;
  if (kind === "face") euler.set(my * .14, mx * .32 + Math.sin(T * .4) * .07, 0);
  else if (kind === "spin") euler.set(.35 + my * .1, T * .28 + mx * .3, 0);
  else if (kind === "ring") euler.set(.95 + my * .12, mx * .25, -T * .16);
  else if (kind === "terrain") euler.set(-1.02 + my * .12, mx * .35 + Math.sin(T * .25) * .12, 0);
  else euler.set(my * .05, T * .015 + mx * .06, 0);
  m4.makeRotationFromEuler(euler); into.setFromMatrix4(m4);
}
let curA = -9, curB = -9;
function setPair(a, b) {
  if (a === curA && b === curB) return;
  const SA = a < 0 ? singular : scenes[a], SB = scenes[b];
  geo.attributes.pA.array.set(SA.pos); geo.attributes.cA.array.set(SA.col);
  geo.attributes.pB.array.set(SB.pos); geo.attributes.cB.array.set(SB.col);
  ["pA", "pB", "cA", "cB"].forEach(k => geo.attributes[k].needsUpdate = true);
  curA = a; curB = b;
}

function computeAnchors() {
  const max = document.documentElement.scrollHeight - innerHeight;
  anchors = secs.map((el, i) => i === 0 ? 0 : Math.min(max, Math.max(0, el.getBoundingClientRect().top + scrollY + el.offsetHeight / 2 - innerHeight / 2)));
}
function sceneAt(y) {
  for (let k = 0; k < anchors.length - 1; k++) if (y < anchors[k + 1]) {
    const f = (y - anchors[k]) / Math.max(1, anchors[k + 1] - anchors[k]);
    const t = Math.min(1, Math.max(0, (f - .18) / .64));
    return [k, k + 1, t * t * (3 - 2 * t)];
  }
  const L = anchors.length - 1; return [L - 1, L, 1];
}
function resize() {
  // the canvas box is 100lvh, so the phone address bar sliding in and out never changes it
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  if (renderer) {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, prNow)); renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio(); material.uniforms.uPR.value = pr; dustMat.uniforms.uPR.value = pr;
    bgMat.uniforms.uRes.value.set(w, h);
    bgRT.setSize(Math.max(32, Math.round(w * .3)), Math.max(32, Math.round(h * .3)));
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  visH = 2 * 1000 * Math.tan(THREE.MathUtils.degToRad(17.5)); visW = visH * (w / h);
  computeAnchors();
}

/* =====================================================================
   SOUND (see audio.js). Browsers only allow audio after a click, so the
   entrance button is the moment sound starts; "Enter silently" skips it.
   ===================================================================== */
const sfx = createAudio();
const soundBtn = $("#sound"), soundLabel = soundBtn.querySelector(".sound-label");
function reflectSound() {
  soundBtn.setAttribute("aria-pressed", String(sfx.on));
  soundLabel.textContent = sfx.on ? "Sound on" : "Sound off";
}
soundBtn.addEventListener("click", () => {
  sfx.setOn(!sfx.on);
  try { localStorage.setItem("iq-sound", sfx.on ? "on" : "off"); } catch (e) {}
  reflectSound();
});
if (!sfx.supported) soundBtn.hidden = true;
document.addEventListener("visibilitychange", () => { document.hidden ? sfx.suspend() : sfx.resume(); });

/* =====================================================================
   RENDER LOOP
   ===================================================================== */
const clock = new THREE.Clock();
const intro = { t: 0, running: true };
let railIdx = -1, vel = 0, lastY = 0;
const shape = { x: 0, y: 0, rx: 0, ry: 0 };
const rail = $$(".rail a");
const tintNow = new THREE.Color(0x2b2410);
function frame() {
  const t = clock.getElapsedTime();
  const y = lenis ? lenis.scroll : scrollY;
  let [a, b, T] = sceneAt(y);
  if (intro.running) { a = -1; b = 0; T = intro.t; }
  const active = T > .5 ? b : Math.max(0, a);
  if (active !== railIdx) {
    const first = railIdx < 0; railIdx = active;
    rail.forEach((r, i) => r.classList.toggle("on", i === active));
    if (!first) sfx.chapter(active); else sfx.chapter(active);
  }
  if (!renderer || !scenes.length || glLost) return;
  setPair(a, b);
  adapt();
  mouse.nx += (mouse.x - mouse.nx) * .06; mouse.ny += (mouse.y - mouse.ny) * .06;
  const dy = y - lastY; lastY = y;
  vel += ((Math.abs(dy) > 400 ? 0 : dy) - vel) * .12;

  const U = material.uniforms, cA = a < 0 ? introCfg : cfg[a], cB = cfg[b];
  U.uSA.value = cA.scale(); U.uSB.value = cB.scale();
  const oA = cA.off(), oB = cB.off(); U.uOA.value.set(oA[0], oA[1], 0); U.uOB.value.set(oB[0], oB[1], 0);
  rotFor(cA.rot, t, U.uRA.value); rotFor(cB.rot, t, U.uRB.value);
  U.uWA.value = cA.wave || 0; U.uWB.value = cB.wave || 0;
  U.uT.value = T; U.uTime.value = reduce ? 0 : t;
  U.uVel.value = reduce ? 0 : Math.max(-24, Math.min(24, vel));
  U.uMouse.value.set(mouse.wx, mouse.wy);
  U.uMouseR.value += ((mouse.active ? visH * .13 : 0) - U.uMouseR.value) * .08;
  sfx.scroll(intro.running ? 0 : vel);
  // where the current shape sits on screen, so scrubbing it can make sound
  const cur = T > .5 ? cB : cA, co = cur.off(), sc = cur.scale();
  shape.x = (co[0] / visW + .5) * innerWidth; shape.y = (.5 - co[1] / visH) * innerHeight;
  shape.rx = sc * .5 / visW * innerWidth; shape.ry = sc * (cur.ry || .5) / visH * innerHeight;

  const target = a < 0 ? tints[0] : tints[a].clone().lerp(tints[b], T);
  tintNow.lerp(target, .05);
  bgMat.uniforms.uTint.value.copy(tintNow);
  const sp = y / Math.max(1, document.documentElement.scrollHeight - innerHeight);
  bgMat.uniforms.uTime.value = reduce ? 0 : t; bgMat.uniforms.uScroll.value = sp;
  dustMat.uniforms.uScroll.value = sp; dustMat.uniforms.uTime.value = reduce ? 0 : t;

  // the nebula is soft, so it renders at 30% size (every other frame on phones) and is upscaled
  if (TIER > 0 || (bgFrame++ & 1) === 0) { renderer.setRenderTarget(bgRT); renderer.render(sceneBg, bgCam); renderer.setRenderTarget(null); }
  renderer.clear(); renderer.render(sceneBlit, bgCam); renderer.render(sceneMain, camera);
}
/* Mouse: particles follow the cursor and shapes tilt toward it.
   Touch: particles react only while a finger is down and swiping sideways;
   as soon as the browser starts scrolling (pointercancel / scroll) the effect lets go. */
let fingerDown = false;
const aim = e => { const nx = e.clientX / innerWidth * 2 - 1, ny = -(e.clientY / innerHeight * 2 - 1); mouse.wx = nx * visW / 2; mouse.wy = ny * visH / 2; return [nx, ny]; };
let lastPX = 0, lastPY = 0;
function scrubSound(e) {
  const dx = e.clientX - lastPX, dy = e.clientY - lastPY; lastPX = e.clientX; lastPY = e.clientY;
  if (intro.running) return;
  const ex = (e.clientX - shape.x) / Math.max(1, shape.rx), ey = (e.clientY - shape.y) / Math.max(1, shape.ry);
  if (ex * ex + ey * ey <= 1.1) sfx.scrub(Math.hypot(dx, dy), e.clientX / innerWidth);
}
addEventListener("pointermove", e => {
  if (e.pointerType === "mouse") { const [nx, ny] = aim(e); mouse.x = nx; mouse.y = ny; mouse.active = 1; scrubSound(e); }
  else if (fingerDown) { aim(e); mouse.active = 1; scrubSound(e); }
}, { passive: true });
addEventListener("pointerdown", e => { if (e.pointerType !== "mouse") { fingerDown = true; aim(e); mouse.active = 1; lastPX = e.clientX; lastPY = e.clientY; } }, { passive: true });
const release = e => { if (e.pointerType !== "mouse") { fingerDown = false; mouse.active = 0; } };
addEventListener("pointerup", release, { passive: true });
addEventListener("pointercancel", release, { passive: true });
document.addEventListener("pointerleave", () => { mouse.active = 0; });
addEventListener("blur", () => { fingerDown = false; mouse.active = 0; });
addEventListener("scroll", () => { if (fingerDown) { fingerDown = false; mouse.active = 0; } }, { passive: true });

/* If a device can't hold ~45fps, shed resolution, then particles, until it can. */
let aT = performance.now(), aFrames = 0, aSlow = 0;
function adapt() {
  const now = performance.now(); aFrames++;
  if (now - aT < 1000) return;
  const fps = aFrames * 1000 / (now - aT); aT = now; aFrames = 0;
  if (document.hidden || intro.running) return;
  aSlow = fps < 45 ? aSlow + 1 : 0;
  if (aSlow >= 2) {
    aSlow = 0;
    if (prNow > 1) { prNow = Math.max(1, prNow - .25); resize(); }
    else if (drawN > 3500) { drawN = Math.max(3500, Math.round(drawN * .75)); geo.setDrawRange(0, drawN); material.uniforms.uSize.value *= 1.08; }
  }
}

/* =====================================================================
   BUILD, THEN OPEN
   ===================================================================== */
const imgs = Promise.all([loadImg("assets/saree-1.webp"), loadImg("assets/kafa-logo.png"), loadImg("assets/chompy-art.webp"), loadImg("assets/me-portrait.webp"),
  new Promise(r => setTimeout(() => { tick(); r(); }, 1400))]);
Promise.all([fontsReady, imgs]).then(([, [saree, kafa, chompy, me]]) => {
  singular = singularity();
  const O = hex("#ffb347"), O2 = hex("#ff6a1a");
  scenes = [
    textScene("IQBAL"), coreScene(),
    saree ? imageScene(saree, 200, (r, g, b, a, x, y) => y < .93 && (lumOf(r, g, b) < .7 || sat(r, g, b) > .38), boost) : coreScene(),
    ringScene(), blobScene(), mfccScene(),
    kafa ? imageScene(kafa, 240, (r, g, b, a) => a > .5 && lumOf(r, g, b) > .6, (r, g, b, ty) => mixc(O, O2, ty)) : textScene("KAFA"),
    chompy ? imageScene(chompy, 230, (r, g, b) => sat(r, g, b) > .4 && lumOf(r, g, b) > .22, boost) : textScene("CHOMPY"),
    me ? imageScene(me, 220, (r, g, b, a) => a > .55 && !(b > r + .06 && lumOf(r, g, b) > .5), portraitColor, (x, y) => y < .68 ? 6 : 1, .035) : starScene(),
    textScene("SAY HI")
  ];
  resize();
  if (renderer) gsap.ticker.add(frame);
  open();
});

function open() {
  boot.target = 1;
  const go = () => {
    boot.live = false;
    document.body.classList.remove("is-booting");
    if (reduce) { $("#boot").remove(); intro.t = 1; intro.running = false; lenis?.start(); heroIn(); return; }
    material && (material.uniforms.uBurst.value = 2.4);
    const tl = gsap.timeline();
    tl.to(".boot-inner", { opacity: 0, scale: .96, duration: .45, ease: "power2.in" })
      .to(".boot-top", { yPercent: -100, duration: 1.1, ease: "expo.inOut" }, "-=.05")
      .to(".boot-bottom", { yPercent: 100, duration: 1.1, ease: "expo.inOut" }, "<")
      .fromTo("#shock", { scale: 0, opacity: 1 }, { scale: 70, opacity: 0, duration: 1.6, ease: "power2.out" }, "<.35")
      .to(intro, { t: 1, duration: 3, ease: "power2.inOut", onComplete: () => { intro.running = false; lenis?.start(); } }, "<")
      .to(material ? material.uniforms.uBurst : {}, { value: 1, duration: 3, ease: "power2.out" }, "<")
      .add(() => $("#boot").remove(), "<1.1")
      .add(heroIn, "<1.2");
  };
  const enter = $("#enter"), withSound = $("#enterSound"), silent = $("#enterSilent");
  const choose = soundOn => {
    enter.querySelectorAll("button").forEach(b => b.disabled = true);
    if (soundOn && sfx.supported) sfx.start();
    reflectSound();
    go();
    sfx.intro(.75);
  };
  withSound.addEventListener("click", () => choose(true));
  silent.addEventListener("click", () => choose(false));
  const wait = () => {
    if (boot.shown < 1) return gsap.delayedCall(.1, wait);
    enter.hidden = false;
    gsap.fromTo(enter, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .7, ease: EASE });
    withSound.focus({ preventScroll: true });
  };
  wait();
}

/* =====================================================================
   DOM CHOREOGRAPHY
   ===================================================================== */
$$(".split").forEach(el => {
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        const w = document.createElement("span"); w.className = "w";
        const i = document.createElement("span"); i.textContent = part; w.appendChild(i); frag.appendChild(w);
      });
      n.replaceWith(frag);
    } else if (n.nodeType === 1) walk(n);
  });
  walk(el);
});

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+";
function scramble(el) {
  if (reduce || !el) return;
  const final = el.dataset.final || (el.dataset.final = el.textContent);
  const t0 = performance.now(), dur = 700;
  const step = now => { const k = Math.min(1, (now - t0) / dur), rv = Math.floor(final.length * k);
    el.textContent = k >= 1 ? final : final.split("").map((ch, i) => i < rv || ch === " " ? ch : GLYPHS[Math.random() * GLYPHS.length | 0]).join("");
    if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  setTimeout(() => { el.textContent = final; }, dur + 400);
}
function heroIn() {
  if (reduce) return;
  gsap.timeline()
    .fromTo(".nav", { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: EASE })
    .add(() => scramble($(".hero .eyebrow")), "<")
    .from(".hero .w > span", { yPercent: 115, duration: 1.2, stagger: .045, ease: EASE }, "<.1")
    .from([".hero .lede", ".hero .ctas", ".hint", ".rail"], { opacity: 0, y: 18, duration: 1, stagger: .08, ease: EASE }, "-=.9");
}

// scroll progress line
ScrollTrigger.create({ start: 0, end: "max", onUpdate: s => { $("#progress").style.transform = `scaleX(${s.progress})`; } });

// manifesto words light up
const man = $("#manText");
man.innerHTML = man.textContent.split(" ").map(w => `<span class="mw">${w}</span>`).join(" ");
const mws = $$(".mw");
ScrollTrigger.create({ trigger: ".manifesto", start: "top 60%", end: reduce ? "top 59%" : "60% 50%", scrub: true,
  onUpdate: s => { const n = s.progress * mws.length * 1.05; mws.forEach((w, i) => { w.style.color = i < n ? "var(--bone)" : ""; }); } });

// counters
const fmt = n => Math.round(n).toLocaleString("en-US");
$$("[data-count]").forEach(el => {
  const end = +el.dataset.count, pre = el.dataset.prefix || "", suf = el.dataset.suffix || "", final = pre + fmt(end) + suf;
  if (reduce) { el.textContent = final; return; }
  const o = { v: 0 };
  gsap.to(o, { v: end, duration: 1.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%" },
    onUpdate: () => { el.textContent = pre + fmt(o.v) + suf; }, onComplete: () => { el.textContent = final; } });
});
if (!reduce) gsap.from(".stat", { opacity: 0, y: 26, duration: 1, stagger: .08, ease: EASE, scrollTrigger: { trigger: ".proof", start: "top 88%" } });

// ghost words: split into letters and size each so the whole word fits 92% of the screen width
const ghosts = $$(".ghost").map(g => {
  const text = g.textContent.trim(); g.textContent = "";
  const w = document.createElement("span"); w.className = "ghost-word";
  text.split("").forEach(ch => { const s = document.createElement("span"); s.textContent = ch; w.appendChild(s); });
  g.appendChild(w); return w;
});
function fitGhosts() {
  const wide = innerWidth > 900;
  ghosts.forEach(w => {
    const g = w.parentElement, side = sideOf(secs.indexOf(g.closest("[data-scene]")));
    w.style.fontSize = "100px";
    const width = w.getBoundingClientRect().width || 1;
    // laptop: fill the open half of the screen (where the particles are), low like a caption
    // phone: fill the width near the top, behind the shape
    const room = wide ? innerWidth * .44 : innerWidth * .92;
    const size = Math.min(innerWidth * (wide ? .16 : .24), 100 * room / width);
    w.style.fontSize = size + "px";
    g.style.textAlign = wide ? (side > 0 ? "right" : "left") : "center";
    g.style.paddingInline = wide ? "3vw" : "0";
    // phone: the section's first 62vh is open space above the panel, so the word sits there
    g.style.position = wide ? "sticky" : "absolute";
    g.style.left = g.style.right = wide ? "" : "0";
    g.style.top = wide ? `${Math.round(innerHeight * .74 - size * .5)}px` : `${Math.round(innerHeight * .44)}px`;
  });
}
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fitGhosts(); ScrollTrigger.refresh(); });
fitGhosts();
addEventListener("resize", () => fitGhosts());

// work chapters
$$(".work").forEach(sec => {
  const panel = sec.querySelector(".panel"), ghost = sec.querySelector(".ghost");
  const words = sec.querySelectorAll("h2 .w > span");
  const bits = sec.querySelectorAll(".panel > p, .facts, .matches, .stages, .grid6, .thumb, .links, .fed, .emotions");
  if (reduce) return;
  if (ghost) {
    // letters rise in one by one as the chapter arrives, then the word drifts gently (never off screen)
    const word = ghost.querySelector(".ghost-word"), dir = sideOf(secs.indexOf(sec));
    gsap.from(word.children, { yPercent: 40, opacity: 0, duration: 1.2, stagger: .07, ease: EASE, scrollTrigger: { trigger: sec, start: "top 70%" } });
    gsap.fromTo(word, { xPercent: 4 * dir }, { xPercent: -4 * dir, ease: "none", scrollTrigger: { trigger: sec, start: "top bottom", end: "bottom top", scrub: true } });
  }
  gsap.set(words, { yPercent: 115 });
  ScrollTrigger.create({ trigger: sec, start: "top 45%", once: true, onEnter: () => {
    scramble(sec.querySelector(".kicker"));
    gsap.to(words, { yPercent: 0, duration: 1.1, stagger: .05, ease: EASE });
    gsap.from(bits, { opacity: 0, y: 22, duration: .9, stagger: .06, ease: EASE, delay: .15 });
    const m = sec.querySelectorAll(".matches > *");
    if (m.length) gsap.from(m, { opacity: 0, y: 30, scale: .92, duration: .7, stagger: .09, ease: EASE, delay: .45 });
  } });
  if (!mobile) gsap.timeline({ scrollTrigger: { trigger: sec, start: "top 80%", end: "bottom 20%", scrub: true } })
    .fromTo(panel, { opacity: 0, y: 80, rotateX: 8 }, { opacity: 1, y: 0, rotateX: 0, ease: "power2.out", duration: .22 })
    .to(panel, { opacity: 1, duration: .56 })
    .to(panel, { opacity: 0, y: -60, ease: "power2.in", duration: .22 });
});

// loops that run only while visible
function whileVisible(el, start, stop) {
  if (reduce || !el) return;
  new IntersectionObserver(([e]) => e.isIntersecting ? start() : stop(), { threshold: .3 }).observe(el);
}
// SALVAGE stages
const stages = $$(".stages li"); let sT = null, sI = -1;
const stageTick = () => { stages.forEach(s => s.classList.remove("on")); sI = (sI + 1) % (stages.length + 2);
  if (sI < stages.length) stages[sI].classList.add("on"); sT = setTimeout(stageTick, stages[sI]?.classList.contains("gate") ? 1100 : 380); };
whileVisible($(".stages"), () => { if (!sT) stageTick(); }, () => { clearTimeout(sT); sT = null; });
// emotions cycle
const emos = $$(".emotions li"); let eT = null, eI = -1;
const emoTick = () => { emos.forEach(x => x.classList.remove("on")); eI = (eI + 1) % emos.length; emos[eI].classList.add("on"); eT = setTimeout(emoTick, 700); };
whileVisible($(".emotions"), () => { if (!eT) emoTick(); }, () => { clearTimeout(eT); eT = null; });
// federated pulses: weights travel in to FedAvg, the global model travels back out
const paths = ["#fl1", "#fl2", "#fl3", "#fl4"].map(s => $(s)), dots = $$(".fed-pulses circle"), core = $(".fed-core");
let fedRaf = null, fedT0 = 0;
const fedLoop = now => {
  const cyc = ((now - fedT0) / 2600) % 1, inward = cyc < .5, k = inward ? cyc * 2 : (cyc - .5) * 2, e = k * k * (3 - 2 * k);
  paths.forEach((p, i) => { const L = p.getTotalLength(), pt = p.getPointAtLength(inward ? e * L : (1 - e) * L);
    dots[i].setAttribute("cx", pt.x); dots[i].setAttribute("cy", pt.y); dots[i].style.fill = inward ? "var(--bone)" : "var(--mari)"; });
  core.style.transform = `scale(${1 + (inward && k > .85 ? (k - .85) * 1.4 : 0)})`; core.style.transformOrigin = "160px 75px";
  fedRaf = requestAnimationFrame(fedLoop);
};
whileVisible($(".fed"), () => { if (!fedRaf) { fedT0 = performance.now(); fedRaf = requestAnimationFrame(fedLoop); } }, () => { cancelAnimationFrame(fedRaf); fedRaf = null; });
if (reduce) paths.forEach((p, i) => { const pt = p.getPointAtLength(p.getTotalLength() / 2); dots[i].setAttribute("cx", pt.x); dots[i].setAttribute("cy", pt.y); });

// journey + contact
if (!reduce) {
  gsap.from("#exp-h .w > span", { yPercent: 115, duration: 1.1, stagger: .06, ease: EASE, scrollTrigger: { trigger: "#exp-h", start: "top 80%" } });
  gsap.from(".role", { opacity: 0, x: -24, duration: .9, stagger: .12, ease: EASE, scrollTrigger: { trigger: ".timeline", start: "top 78%" } });
  const line = $(".tl-line line"); line.style.setProperty("--dash", 100);
  ScrollTrigger.create({ trigger: ".timeline", start: "top 75%", end: "bottom 60%", scrub: true, onUpdate: s => line.style.setProperty("--dash", 100 - s.progress * 100) });
  gsap.from("#contact-h .w > span", { yPercent: 115, duration: 1.1, stagger: .05, ease: EASE, scrollTrigger: { trigger: "#contact-h", start: "top 85%" } });
  gsap.from(".contact .lede, .email, .socials", { opacity: 0, y: 20, duration: .9, stagger: .08, ease: EASE, scrollTrigger: { trigger: ".contact-inner", start: "top 85%" } });
}

// marquee
const track = $(".mq-track"); const orig = track.children.length;
track.innerHTML += track.innerHTML;
[...track.children].forEach((s, i) => { if (i >= orig) s.setAttribute("aria-hidden", "true"); });

// nav hides on the way down
const nav = $("#nav");
let navHidden = false;
const setNav = hide => {
  if (hide === navHidden) return; navHidden = hide;
  gsap.to(nav, { y: hide ? -120 : 0, opacity: hide ? 0 : 1, duration: .4, ease: "power3.out", overwrite: "auto" });
};
ScrollTrigger.create({ start: 0, end: "max", onUpdate: s => setNav(s.direction === 1 && s.scroll() > 100) });

// tilt + magnetic
if (fine && !reduce) {
  $$(".tilt").forEach(el => {
    const rx = gsap.quickTo(el, "rotationX", { duration: .6, ease: "power3.out" }), ry = gsap.quickTo(el, "rotationY", { duration: .6, ease: "power3.out" });
    gsap.set(el, { transformPerspective: 800 });
    el.addEventListener("pointermove", e => { const r = el.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - .5) * 12); rx(-((e.clientY - r.top) / r.height - .5) * 9); });
    el.addEventListener("pointerleave", () => { rx(0); ry(0); });
  });
  $$(".btn, .nav-cta, .email, .links a").forEach(el => el.addEventListener("pointerenter", () => sfx.hover()));
  $$(".magnetic").forEach(el => {
    const x = gsap.quickTo(el, "x", { duration: .5, ease: "elastic.out(1, .4)" }), y = gsap.quickTo(el, "y", { duration: .5, ease: "elastic.out(1, .4)" });
    el.addEventListener("pointermove", e => { const r = el.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * .25); y((e.clientY - r.top - r.height / 2) * .35); });
    el.addEventListener("pointerleave", () => { x(0); y(0); });
  });
}

// copy email
const email = $(".email"), tip = email.querySelector(".email-tip");
email.addEventListener("click", async () => {
  const addr = email.dataset.email;
  try { await navigator.clipboard.writeText(addr); tip.textContent = "Copied. Talk soon."; }
  catch { location.href = "mailto:" + addr; tip.textContent = "Opening your mail app"; }
  setTimeout(() => { tip.textContent = "Click to copy"; }, 2400);
});

let rT, lastW = innerWidth;
addEventListener("resize", () => {
  clearTimeout(rT);
  rT = setTimeout(() => {
    // phones fire resize when the address bar slides; only a real width change needs a relayout
    if (coarse && innerWidth === lastW) return;
    lastW = innerWidth; resize(); ScrollTrigger.refresh();
  }, 200);
});
ScrollTrigger.addEventListener("refresh", computeAnchors);

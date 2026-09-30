import * as THREE from "three";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const mobile = matchMedia("(max-width: 900px)").matches;
gsap.registerPlugin(ScrollTrigger);
const EASE = "expo.out";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* =====================================================================
   BOOT: the counter follows real loading (fonts, particle source images)
   ===================================================================== */
const boot = { target: 0, shown: 0 };
const bootNum = $("#bootNum"), bootBar = $("#bootBar");
const TASKS = 5; let done = 0;
const tick = () => { done++; boot.target = done / TASKS; };
gsap.ticker.add(() => {
  boot.shown += (boot.target - boot.shown) * 0.08;
  const v = Math.min(100, Math.round(boot.shown * 100));
  bootNum.textContent = String(v).padStart(3, "0");
  bootBar.style.transform = `scaleX(${boot.shown})`;
});

const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => { tick(); res(i); }; i.onerror = () => { tick(); res(null); }; i.src = src; });
const fontsReady = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() =>
  Promise.all([document.fonts?.load?.('700 100px "Clash Display"'), document.fonts?.load?.('600 100px "Clash Display"')]).catch(() => {})).then(tick);

/* =====================================================================
   SMOOTH SCROLL
   ===================================================================== */
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new Lenis({ lerp: 0.09 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
$$('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
  const id = a.getAttribute("href"); if (id.length < 2) return;
  e.preventDefault();
  const el = $(id);
  const y = el.dataset.scene && anchors.length ? anchors[+el.dataset.scene] : el.offsetTop;
  lenis ? lenis.scrollTo(y, { duration: 1.6 }) : scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
}));

/* =====================================================================
   PARTICLE SCENES (all normalised: longest side = 1, centred)
   ===================================================================== */
const N = mobile ? 9000 : 16000;
const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const BONE = hex("#ece8dc"), MARI = hex("#f2b134");
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function fromCandidates(cand, step, zDepth, colorOf) {
  // cand: flat [x, y, r, g, b, ...] in pixel space
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let i = 0; i < cand.length; i += 5) { const x = cand[i], y = cand[i + 1]; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, span = Math.max(maxX - minX, maxY - minY) || 1;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), k = cand.length / 5;
  for (let i = 0; i < N; i++) {
    const j = (Math.random() * k | 0) * 5;
    const x = cand[j] + (Math.random() - .5) * step, y = cand[j + 1] + (Math.random() - .5) * step;
    const c = colorOf(cand[j + 2], cand[j + 3], cand[j + 4], (y - minY) / (maxY - minY || 1));
    pos[i * 3] = (x - cx) / span; pos[i * 3 + 1] = -(y - cy) / span;
    const lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    pos[i * 3 + 2] = (lum - .5) * zDepth + (Math.random() - .5) * 0.02;
    col.set(c, i * 3);
  }
  return { pos, col };
}

function textScene(txt, weight = 700) {
  const W = 1600, H = 460, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.font = `${weight} 330px "Clash Display", "Satoshi", sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText(txt, W / 2, H / 2 + 10);
  const d = g.getImageData(0, 0, W, H).data, cand = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 128) cand.push(x, y, 0, 0, 0);
  return fromCandidates(cand, 2, 0, () => Math.random() < .16 ? MARI : mixc(BONE, [1, 1, 1], Math.random() * .3));
}

function imageScene(img, sampleW, keep, colorFn, crop) {
  const [sx, sy, sw, sh] = crop || [0, 0, img.naturalWidth, img.naturalHeight];
  const w = sampleW, h = Math.round(sampleW * sh / sw);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, cand = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, a = d[i + 3] / 255;
    if (keep(r, gg, b, a, x / w, y / h)) cand.push(x, y, r, gg, b);
  }
  return fromCandidates(cand, 1, 0.12, colorFn);
}
const sat = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
const lumOf = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
const boost = (r, g, b) => [Math.min(1, r * 1.25 + .07), Math.min(1, g * 1.25 + .07), Math.min(1, b * 1.25 + .07)];

function scatterScene() {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * 6.283, r = 1.4 + Math.random() * 1.2, s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(th) * s * r * 1.6, u * r, Math.sin(th) * s * r], i * 3);
    col.set(Math.random() < .15 ? MARI : BONE, i * 3);
  }
  return { pos, col };
}
function coreScene() {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    let x, y, z;
    if (i < N * .72) { const k = i / (N * .72); y = 1 - k * 2; const r = Math.sqrt(1 - y * y), th = g * i; x = Math.cos(th) * r; z = Math.sin(th) * r; const R = .5; x *= R; y *= R; z *= R; }
    else { const u = Math.random() * 2 - 1, th = Math.random() * 6.283, s = Math.sqrt(1 - u * u), r = Math.cbrt(Math.random()) * .34; x = Math.cos(th) * s * r; y = u * r; z = Math.sin(th) * s * r; }
    pos.set([x, y, z], i * 3);
    col.set(i >= N * .72 ? MARI : mixc(BONE, MARI, Math.max(0, -y) * .9), i * 3);
  }
  return { pos, col };
}
function ringScene() {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), R = .42;
  for (let i = 0; i < N; i++) {
    const r = Math.random();
    let x, y, z, c;
    if (r < .58) {
      const s = Math.random() * 9 | 0, gate = s === 3, a = Math.PI / 2 - s * (2 * Math.PI / 9);
      const rr = (gate ? .085 : .05) * Math.cbrt(Math.random()), u = Math.random() * 2 - 1, th = Math.random() * 6.283, sq = Math.sqrt(1 - u * u);
      x = Math.cos(a) * R + Math.cos(th) * sq * rr; y = Math.sin(a) * R + u * rr; z = Math.sin(th) * sq * rr;
      c = gate ? MARI : BONE;
    } else {
      const a = Math.random() * 6.283, j = (Math.random() - .5) * .014;
      x = Math.cos(a) * (R + j); y = Math.sin(a) * (R + j); z = (Math.random() - .5) * .014;
      c = mixc(BONE, [.36, .41, .52], .6);
    }
    pos.set([x, y, z], i * 3); col.set(c, i * 3);
  }
  return { pos, col };
}
function blobScene() {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const G1 = hex("#34f5b9"), G2 = hex("#0a8a64");
  for (let i = 0; i < N; i++) {
    let x, y, z, c;
    if (i < N * .84) {
      const u = Math.random() * 2 - 1, th = Math.random() * 6.283, s = Math.sqrt(1 - u * u);
      const ph = Math.acos(u), rr = .4 * (1 + .1 * Math.sin(3 * th) * Math.sin(2 * ph)) * (i % 4 === 0 ? Math.cbrt(Math.random()) : 1);
      x = Math.cos(th) * s * rr; y = u * rr; z = Math.sin(th) * s * rr; c = mixc(G1, G2, (1 - y / .45) / 2);
    } else {
      const a = Math.random() * 6.283, rr = .56 + (Math.random() - .5) * .03;
      x = Math.cos(a) * rr; y = (Math.random() - .5) * .02; z = Math.sin(a) * rr * .98; c = mixc(G1, BONE, .5);
    }
    pos.set([x, y, z], i * 3); col.set(c, i * 3);
  }
  return { pos, col };
}
function starScene() {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos.set([(Math.random() - .5) * 1.8, (Math.random() - .5) * 1.1, (Math.random() - .7) * 1.2], i * 3);
    col.set(mixc([.25, .29, .4], Math.random() < .08 ? MARI : BONE, Math.random() * .55), i * 3);
  }
  return { pos, col };
}

/* =====================================================================
   RENDERER + SHADER
   ===================================================================== */
const canvas = $("#gl");
let renderer, material, geo, camera, scene3, points;
let visW = 1, visH = 1;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x070b16, 1);
} catch (e) { canvas.style.display = "none"; renderer = null; }

const VERT = /* glsl */`
attribute vec3 pA; attribute vec3 pB; attribute vec3 cA; attribute vec3 cB; attribute vec4 rnd;
uniform float uT, uTime, uSize, uPR, uBurst, uSA, uSB, uMouseR;
uniform vec3 uOA, uOB; uniform mat3 uRA, uRB; uniform vec2 uMouse;
varying vec3 vC; varying float vA;
void main(){
  float d = rnd.w * 0.42;
  float t = smoothstep(d, d + 0.58, uT);
  vec3 a = uRA * pA * uSA + uOA;
  vec3 b = uRB * pB * uSB + uOB;
  vec3 p = mix(a, b, t);
  float S = mix(uSA, uSB, t);
  float burst = sin(t * 3.14159) * uBurst;
  // explode outward along a per-particle direction, with a swirl, then re-form
  p += rnd.xyz * burst * S * 0.75;
  p.xy += vec2(-p.y, p.x) * burst * 0.25 * (rnd.w - 0.5);
  // idle breathing
  p += vec3(sin(uTime * .7 + rnd.w * 40.), cos(uTime * .6 + rnd.w * 31.), sin(uTime * .5 + rnd.w * 17.)) * S * 0.0035;
  // cursor pushes particles away and toward the camera
  vec2 dm = p.xy - uMouse; float dist = length(dm);
  float f = smoothstep(uMouseR, 0., dist);
  p.xy += dm / (dist + .001) * f * uMouseR * 0.55;
  p.z += f * uMouseR * 0.6;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPR * (0.55 + rnd.w * 0.9) * (1000. / -mv.z) * (1. + burst * .6);
  vC = mix(cA, cB, t) * (1. + f * .6);
  vA = 0.6 + 0.4 * rnd.w;
}`;
const FRAG = /* glsl */`
varying vec3 vC; varying float vA;
void main(){
  vec2 c = gl_PointCoord - .5; float r = length(c);
  if (r > .5) discard;
  gl_FragColor = vec4(vC, smoothstep(.5, .08, r) * vA);
}`;

if (renderer) {
  scene3 = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, 10, 4000);
  camera.position.z = 1000;
  geo = new THREE.BufferGeometry();
  const rnd = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * 6.283, s = Math.sqrt(1 - u * u), m = .3 + Math.random() * .7;
    rnd.set([Math.cos(th) * s * m, u * m, Math.sin(th) * s * m, Math.random()], i * 4);
  }
  ["pA", "pB", "cA", "cB"].forEach(k => geo.setAttribute(k, new THREE.BufferAttribute(new Float32Array(N * 3), 3)));
  geo.setAttribute("rnd", new THREE.BufferAttribute(rnd, 4));
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  material = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    uniforms: {
      uT: { value: 0 }, uTime: { value: 0 }, uSize: { value: mobile ? 2.4 : 2.6 }, uPR: { value: 1 }, uBurst: { value: reduce ? 0 : 1 },
      uSA: { value: 1 }, uSB: { value: 1 }, uOA: { value: new THREE.Vector3() }, uOB: { value: new THREE.Vector3() },
      uRA: { value: new THREE.Matrix3() }, uRB: { value: new THREE.Matrix3() },
      uMouse: { value: new THREE.Vector2(9999, 9999) }, uMouseR: { value: 0 }
    }
  });
  points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  scene3.add(points);
}

/* per-scene placement, in world units. Desktop: shape opposite the panel. Phone: shape up top. */
const SIDE = { left: 1, right: -1 };
const cfg = [
  { name: "name",   scale: () => Math.min(visW * (mobile ? .9 : .62), visH * 2.2), off: () => [0, visH * (mobile ? .2 : .14)], rot: "face" },
  { name: "core",   scale: () => mobile ? visW * .62 : visH * .56, off: () => mobile ? [0, visH * .3] : [visW * .3, visH * .04], rot: "spin" },
  { name: "saree",  scale: () => visH * (mobile ? .48 : .86), off: () => mobile ? [0, visH * .18] : [visW * .2 * SIDE.left, -visH * .02], rot: "face" },
  { name: "ring",   scale: () => mobile ? visW * .95 : visH * .8, off: () => mobile ? [0, visH * .18] : [visW * .2 * SIDE.right, 0], rot: "ring" },
  { name: "blob",   scale: () => mobile ? visW * .78 : visH * .7, off: () => mobile ? [0, visH * .18] : [visW * .2 * SIDE.left, 0], rot: "spin" },
  { name: "kafa",   scale: () => visH * (mobile ? .42 : .66), off: () => mobile ? [0, visH * .18] : [visW * .2 * SIDE.right, 0], rot: "face" },
  { name: "chompy", scale: () => mobile ? Math.min(visW * .95, visH * .45) : visH * .82, off: () => mobile ? [0, visH * .18] : [visW * .2 * SIDE.left, 0], rot: "face" },
  { name: "stars",  scale: () => Math.max(visW, visH) * 1.15, off: () => [0, 0], rot: "drift" },
  { name: "hi",     scale: () => Math.min(visW * (mobile ? .92 : .6), visH * 2.2), off: () => [0, visH * (mobile ? .26 : .22)], rot: "face" }
];
let scenes = [], scatter = null;

const mouse = { x: 0, y: 0, wx: 9999, wy: 9999, active: 0, nx: 0, ny: 0 };
const euler = new THREE.Euler(), m4 = new THREE.Matrix4();
function rotFor(kind, t, into) {
  const mx = mouse.nx, my = mouse.ny, T = reduce ? 0 : t;
  if (kind === "face") euler.set(my * .14, mx * .32 + Math.sin(T * .4) * .07, 0);
  else if (kind === "spin") euler.set(.35 + my * .1, T * .28 + mx * .3, 0);
  else if (kind === "ring") euler.set(.95 + my * .12, mx * .25, -T * .16);
  else euler.set(my * .05, T * .015 + mx * .06, 0);
  m4.makeRotationFromEuler(euler); into.setFromMatrix4(m4);
}

let curA = -2, curB = -2;
function setPair(a, b) {
  if (a === curA && b === curB) return;
  const SA = a < 0 ? scatter : scenes[a], SB = scenes[b];
  geo.attributes.pA.array.set(SA.pos); geo.attributes.cA.array.set(SA.col);
  geo.attributes.pB.array.set(SB.pos); geo.attributes.cB.array.set(SB.col);
  ["pA", "pB", "cA", "cB"].forEach(k => geo.attributes[k].needsUpdate = true);
  curA = a; curB = b;
}

function resize() {
  const w = innerWidth, h = innerHeight;
  if (renderer) {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.setSize(w, h, false);
    material.uniforms.uPR.value = renderer.getPixelRatio();
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  visH = 2 * 1000 * Math.tan(THREE.MathUtils.degToRad(17.5)); visW = visH * (w / h);
  computeAnchors();
}

/* scroll position -> which two scenes, and how far between them */
let anchors = [];
function computeAnchors() {
  const secs = $$("[data-scene]");
  const max = document.documentElement.scrollHeight - innerHeight;
  anchors = secs.map((el, i) => {
    if (i === 0) return 0;
    const top = el.getBoundingClientRect().top + scrollY;
    return Math.min(max, Math.max(0, top + el.offsetHeight / 2 - innerHeight / 2));
  });
}
function sceneAt(y) {
  for (let k = 0; k < anchors.length - 1; k++) {
    if (y < anchors[k + 1]) {
      const f = (y - anchors[k]) / Math.max(1, anchors[k + 1] - anchors[k]);
      const t = Math.min(1, Math.max(0, (f - .18) / .64));
      return [k, k + 1, t * t * (3 - 2 * t)];
    }
  }
  const L = anchors.length - 1; return [L - 1, L, 1];
}

/* intro: scattered cloud collapses into the name */
const intro = { t: 0, running: true };

/* =====================================================================
   RENDER LOOP
   ===================================================================== */
const clock = new THREE.Clock();
let railIdx = -1;
const rail = $$(".rail a");
function frame() {
  const t = clock.getElapsedTime();
  const y = lenis ? lenis.scroll : scrollY;
  let [a, b, T] = sceneAt(y);
  if (intro.running) { a = -1; b = 0; T = intro.t; }
  const active = T > .5 ? b : a;
  if (active !== railIdx && active >= 0) { railIdx = active; rail.forEach((r, i) => r.classList.toggle("on", i === active)); }
  if (!renderer || !scenes.length) return;
  setPair(a, b);

  mouse.nx += (mouse.x - mouse.nx) * .06; mouse.ny += (mouse.y - mouse.ny) * .06;
  const U = material.uniforms;
  const cA = a < 0 ? { scale: () => Math.max(visW, visH) * .5, off: () => [0, 0], rot: "drift" } : cfg[a], cB = cfg[b];
  U.uSA.value = cA.scale(); U.uSB.value = cB.scale();
  const oA = cA.off(), oB = cB.off();
  U.uOA.value.set(oA[0], oA[1], 0); U.uOB.value.set(oB[0], oB[1], 0);
  rotFor(cA.rot, t, U.uRA.value); rotFor(cB.rot, t, U.uRB.value);
  U.uT.value = T; U.uTime.value = reduce ? 0 : t;
  U.uMouse.value.set(mouse.wx, mouse.wy);
  U.uMouseR.value += ((mouse.active ? visH * .13 : 0) - U.uMouseR.value) * .08;
  renderer.render(scene3, camera);
}

addEventListener("pointermove", e => {
  mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = -(e.clientY / innerHeight * 2 - 1);
  mouse.wx = mouse.x * visW / 2; mouse.wy = mouse.y * visH / 2; mouse.active = 1;
}, { passive: true });
document.addEventListener("pointerleave", () => { mouse.active = 0; });
addEventListener("blur", () => { mouse.active = 0; });

/* =====================================================================
   BUILD SCENES, THEN LIFT THE CURTAIN
   ===================================================================== */
const imgs = Promise.all([
  loadImg("assets/saree-1.webp"), loadImg("assets/kafa-logo.png"), loadImg("assets/chompy-art.webp"),
  new Promise(r => setTimeout(() => { tick(); r(); }, 900))
]);

Promise.all([fontsReady, imgs]).then(([, [saree, kafa, chompy]]) => {
  scatter = scatterScene();
  const O = hex("#ffb347"), O2 = hex("#ff6a1a");
  scenes = [
    textScene("IQBAL"),
    coreScene(),
    saree ? imageScene(saree, 200, (r, g, b, a, x, y) => y < .93 && (lumOf(r, g, b) < .7 || sat(r, g, b) > .38), (r, g, b) => boost(r, g, b)) : coreScene(),
    ringScene(),
    blobScene(),
    kafa ? imageScene(kafa, 240, (r, g, b, a) => a > .5 && lumOf(r, g, b) > .6, (r, g, b, ty) => mixc(O, O2, ty)) : textScene("KAFA"),
    chompy ? imageScene(chompy, 230, (r, g, b, a) => sat(r, g, b) > .4 && lumOf(r, g, b) > .22, (r, g, b) => boost(r, g, b)) : textScene("CHOMPY"),
    starScene(),
    textScene("SAY HI")
  ];
  resize();
  if (renderer) gsap.ticker.add(frame);
  liftCurtain();
});

function liftCurtain() {
  boot.target = 1;
  const go = () => {
    document.body.classList.remove("is-booting");
    if (reduce) {
      $("#boot").remove(); intro.t = 1; intro.running = false; lenis?.start(); heroIn(); return;
    }
    const tl = gsap.timeline();
    tl.to("#boot", { clipPath: "inset(0 0 100% 0)", duration: 1.1, ease: "expo.inOut", onComplete: () => $("#boot").remove() })
      .to(intro, { t: 1, duration: 2.6, ease: "power2.out", onComplete: () => { intro.running = false; lenis?.start(); } }, "-=0.6")
      .add(heroIn, "-=2.1");
  };
  // let the counter visibly reach 100
  gsap.delayedCall(reduce ? 0 : .7, go);
}

/* =====================================================================
   DOM CHOREOGRAPHY
   ===================================================================== */
// word splitting
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

// text scramble: labels decode like a model resolving a query
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+";
function scramble(el) {
  if (reduce) return;
  const final = el.dataset.final || (el.dataset.final = el.textContent);
  let f = 0; const total = 26;
  const step = () => {
    f++;
    const reveal = Math.floor(final.length * f / total);
    el.textContent = final.split("").map((ch, i) => i < reveal || ch === " " ? ch : GLYPHS[Math.random() * GLYPHS.length | 0]).join("");
    if (f < total) requestAnimationFrame(step); else el.textContent = final;
  };
  step();
}

function heroIn() {
  if (reduce) return;
  const tl = gsap.timeline();
  tl.from(".nav", { y: -30, opacity: 0, duration: 1, ease: EASE })
    .add(() => scramble($(".hero .eyebrow")), "<")
    .from(".hero .w > span", { yPercent: 115, duration: 1.2, stagger: .045, ease: EASE }, "<.1")
    .from([".hero .lede", ".hero .ctas", ".hint", ".rail"], { opacity: 0, y: 18, duration: 1, stagger: .08, ease: EASE }, "-=.9");
}

// manifesto: words light up as you read
const man = $("#manText");
man.innerHTML = man.textContent.split(" ").map(w => `<span class="mw">${w}</span>`).join(" ");
const mws = $$(".mw");
ScrollTrigger.create({
  trigger: ".manifesto", start: "top 60%", end: reduce ? "top 59%" : "60% 50%", scrub: true,
  onUpdate: s => { const n = s.progress * mws.length * 1.05; mws.forEach((w, i) => { w.style.color = i < n ? "var(--bone)" : ""; }); }
});

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

// work panels: arrive as the particles finish forming, leave as they explode
$$(".work").forEach(sec => {
  const panel = sec.querySelector(".panel");
  const kicker = sec.querySelector(".kicker");
  const words = sec.querySelectorAll("h2 .w > span");
  const bits = sec.querySelectorAll(".panel > p, .facts, .matches, .stages, .grid6, .thumb, .links");
  if (reduce) return;
  gsap.set(words, { yPercent: 115 });
  ScrollTrigger.create({
    trigger: sec, start: "top 45%", once: true,
    onEnter: () => {
      scramble(kicker);
      gsap.to(words, { yPercent: 0, duration: 1.1, stagger: .05, ease: EASE });
      gsap.from(bits, { opacity: 0, y: 22, duration: .9, stagger: .06, ease: EASE, delay: .15 });
      const m = sec.querySelectorAll(".matches > *");
      if (m.length) gsap.from(m, { opacity: 0, y: 30, scale: .92, duration: .7, stagger: .09, ease: EASE, delay: .45 });
    }
  });
  if (!mobile) {
    gsap.timeline({ scrollTrigger: { trigger: sec, start: "top 80%", end: "bottom 20%", scrub: true } })
      .fromTo(panel, { opacity: 0, y: 80, rotateX: 8 }, { opacity: 1, y: 0, rotateX: 0, ease: "power2.out", duration: .22 })
      .to(panel, { opacity: 1, duration: .56 })
      .to(panel, { opacity: 0, y: -60, ease: "power2.in", duration: .22 });
  }
});

// SALVAGE stages run in a loop while visible, pausing on the gate
const stages = $$(".stages li"); let sT = null, sI = -1;
function stageTick() {
  stages.forEach(s => s.classList.remove("on"));
  sI = (sI + 1) % (stages.length + 2);
  if (sI < stages.length) stages[sI].classList.add("on");
  sT = setTimeout(stageTick, stages[sI]?.classList.contains("gate") ? 1100 : 380);
}
if (!reduce) new IntersectionObserver(([e]) => {
  if (e.isIntersecting && !sT) stageTick();
  if (!e.isIntersecting && sT) { clearTimeout(sT); sT = null; }
}, { threshold: .4 }).observe($(".stages"));

// journey
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
ScrollTrigger.create({ start: 0, end: "max", onUpdate: s => nav.classList.toggle("hide", s.direction === 1 && s.scroll() > 500) });

// tilt + magnetic
if (fine && !reduce) {
  $$(".tilt").forEach(el => {
    const rx = gsap.quickTo(el, "rotationX", { duration: .6, ease: "power3.out" }), ry = gsap.quickTo(el, "rotationY", { duration: .6, ease: "power3.out" });
    gsap.set(el, { transformPerspective: 800 });
    el.addEventListener("pointermove", e => { const r = el.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - .5) * 12); rx(-((e.clientY - r.top) / r.height - .5) * 9); });
    el.addEventListener("pointerleave", () => { rx(0); ry(0); });
  });
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

let rT; addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(() => { resize(); ScrollTrigger.refresh(); }, 150); });
ScrollTrigger.addEventListener("refresh", computeAnchors);

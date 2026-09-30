(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = !!window.gsap;
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  const EASE = "expo.out";

  /* ---------- smooth scroll (skipped for reduced motion) ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1 });
    if (hasGsap) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
      const id = a.getAttribute("href"); if (id.length < 2) return;
      e.preventDefault(); lenis.scrollTo(id === "#top" ? 0 : id, { offset: -20, duration: 1.2 });
    }));
  }

  /* ---------- nav hides on scroll down, returns on scroll up ---------- */
  const nav = document.getElementById("nav");
  if (hasGsap) {
    ScrollTrigger.create({ start: 120, end: "max", onUpdate: s => nav.classList.toggle("hide", s.direction === 1 && s.scroll() > 400) });
  }

  /* ---------- hero particle field: vectors converge into the name ---------- */
  const canvas = document.getElementById("field");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1, pts = [], scatter = 0, running = true;
  const mouse = { x: -9999, y: -9999, on: false };
  const MARI = "242,177,52", BONE = "236,232,220";

  function sampleText() {
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const o = off.getContext("2d");
    const narrow = W < 760;
    const size = Math.min(W * (narrow ? 0.28 : 0.22), H * (narrow ? 0.26 : 0.42));
    o.fillStyle = "#fff";
    o.font = `700 ${size}px "Clash Display", "Satoshi", sans-serif`;
    o.textAlign = "center"; o.textBaseline = "middle";
    const cy = narrow ? H * 0.30 : H * 0.36;
    o.fillText("IQBAL", W / 2, cy);
    const data = o.getImageData(0, 0, W, H).data;
    const gap = Math.max(3, Math.round(size / 52));
    const out = [];
    for (let y = 0; y < H; y += gap) for (let x = 0; x < W; x += gap) if (data[(y * W + x) * 4 + 3] > 128) out.push([x, y]);
    return out;
  }

  function build() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const targets = sampleText();
    const old = pts;
    pts = targets.map(([tx, ty], i) => {
      const p = old[i];
      return {
        x: p ? p.x : Math.random() * W, y: p ? p.y : Math.random() * H,
        vx: 0, vy: 0, tx, ty,
        r: Math.random() < 0.15 ? 2.4 : 1.8,
        c: Math.random() < 0.14 ? MARI : BONE,
        a: 0.75 + Math.random() * 0.25,
        seed: Math.random() * Math.PI * 2
      };
    });
    // loose "unmatched" vectors drifting around the name
    for (let i = 0; i < Math.min(260, W / 5); i++) pts.push({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, tx: null, ty: null, r: 1.1, c: BONE, a: 0.18, seed: Math.random() * 6.28 });
    if (reduce) { pts.forEach(p => { if (p.tx !== null) { p.x = p.tx; p.y = p.ty; } }); draw(0); }
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      ctx.fillStyle = `rgba(${p.c},${p.a})`;
      ctx.fillRect(p.x, p.y, p.r, p.r);
    }
  }

  function step(t) {
    if (!running) return;
    const R = 110, R2 = R * R;
    for (const p of pts) {
      if (p.tx === null) {
        p.x += Math.cos(t / 3000 + p.seed) * 0.15; p.y += Math.sin(t / 2600 + p.seed) * 0.15;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        continue;
      }
      // spring toward the target, loosened as the hero scrolls away
      const tx = p.tx + Math.cos(p.seed + t / 900) * scatter * 60;
      const ty = p.ty + Math.sin(p.seed * 1.3 + t / 1100) * scatter * 60 - scatter * 40;
      p.vx += (tx - p.x) * 0.045; p.vy += (ty - p.y) * 0.045;
      if (mouse.on) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.01) { const f = (1 - d2 / R2) * 6; const d = Math.sqrt(d2); p.vx += dx / d * f; p.vy += dy / d * f; }
      }
      p.vx *= 0.82; p.vy *= 0.82;
      p.x += p.vx; p.y += p.vy;
    }
    draw(t);
    requestAnimationFrame(step);
  }

  function pointer(e) { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true; }
  const hero = document.querySelector(".hero");
  hero.addEventListener("pointermove", pointer);
  hero.addEventListener("pointerleave", () => { mouse.on = false; });

  const startField = () => { build(); if (!reduce) requestAnimationFrame(step); };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(startField);
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(build, 150); });
  // pause the loop when the hero is off screen
  new IntersectionObserver(([e]) => {
    const was = running; running = e.isIntersecting;
    if (running && !was && !reduce) requestAnimationFrame(step);
  }).observe(hero);
  if (hasGsap && !reduce) {
    ScrollTrigger.create({ trigger: hero, start: "top top", end: "bottom top", scrub: true, onUpdate: s => { scatter = s.progress * 1.6; } });
  }

  /* ---------- word-by-word headline reveals ---------- */
  document.querySelectorAll(".split").forEach(el => {
    const walk = node => {
      [...node.childNodes].forEach(n => {
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
    };
    walk(el);
  });

  if (hasGsap && !reduce) {
    const heroWords = document.querySelectorAll(".hero .w > span");
    gsap.set(heroWords, { yPercent: 110 });
    gsap.set([".hero .eyebrow", ".hero .lede", ".hero .ctas", ".hero-hint"], { opacity: 0, y: 16 });
    const tl = gsap.timeline({ delay: 0.5 });
    tl.to(".hero .eyebrow", { opacity: 1, y: 0, duration: 0.8, ease: EASE })
      .to(heroWords, { yPercent: 0, duration: 1.1, stagger: 0.045, ease: EASE }, "-=0.55")
      .to(".hero .lede", { opacity: 1, y: 0, duration: 0.9, ease: EASE }, "-=0.8")
      .to(".hero .ctas", { opacity: 1, y: 0, duration: 0.9, ease: EASE }, "-=0.75")
      .to(".hero-hint", { opacity: 1, y: 0, duration: 0.9, ease: EASE }, "-=0.6");

    document.querySelectorAll(".section-title, .contact h2").forEach(h => {
      const words = h.querySelectorAll(".w > span");
      gsap.from(words, { yPercent: 110, duration: 1, stagger: 0.06, ease: EASE, scrollTrigger: { trigger: h, start: "top 85%" } });
    });

    gsap.from(".stat", { opacity: 0, y: 24, duration: 0.9, stagger: 0.07, ease: EASE, scrollTrigger: { trigger: ".proof", start: "top 85%" } });
    gsap.from(".role", { opacity: 0, x: -18, duration: 0.9, stagger: 0.12, ease: EASE, scrollTrigger: { trigger: ".timeline", start: "top 80%" } });
    gsap.from(".contact .lede, .email, .socials", { opacity: 0, y: 20, duration: 0.9, stagger: 0.08, ease: EASE, scrollTrigger: { trigger: ".contact", start: "top 70%" } });
  }

  /* ---------- count-up on the proof band ---------- */
  const fmt = n => Math.round(n).toLocaleString("en-US");
  document.querySelectorAll("[data-count]").forEach(el => {
    const end = +el.dataset.count, pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
    const final = pre + fmt(end) + suf;
    if (!hasGsap || reduce) { el.textContent = final; return; }
    const o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%" },
      onUpdate: () => { el.textContent = pre + fmt(o.v) + suf; }, onComplete: () => { el.textContent = final; } });
  });

  /* ---------- sticky stack: earlier cards recede as the next arrives ---------- */
  if (hasGsap && !reduce && matchMedia("(min-width: 901px)").matches) {
    const cards = gsap.utils.toArray(".card");
    cards.forEach((card, i) => { card.style.zIndex = i + 1; });
    // Sticky cards confuse trigger measurement, so read the next card's live position instead.
    const TOP = 96;
    const update = () => {
      const vh = innerHeight;
      cards.forEach((card, i) => {
        const next = cards[i + 1]; if (!next) return;
        const t = next.getBoundingClientRect().top;
        const p = Math.min(1, Math.max(0, (vh - t) / (vh - TOP)));
        card.style.transform = `scale(${1 - 0.07 * p})`;
        card.style.filter = p > 0.001 ? `brightness(${1 - 0.6 * p}) blur(${2 * p}px)` : "";
      });
    };
    ScrollTrigger.create({ trigger: ".stack", start: "top bottom", end: "bottom top", onUpdate: update, onRefresh: update });
  }

  /* ---------- saree search replay: scan the index, results land in rank order ---------- */
  const demo = document.querySelector(".search-demo");
  const bar = demo.querySelector(".sd-scan i"), count = demo.querySelector(".sd-count");
  const results = demo.querySelectorAll(".sd-results li");
  function runSearch() {
    if (!hasGsap || reduce) { bar.style.setProperty("--p", 1); count.textContent = "1,059"; return; }
    const o = { v: 0 };
    const tl = gsap.timeline();
    tl.set(results, { opacity: 0, y: 30, scale: 0.94 })
      .to(o, { v: 1059, duration: 1.1, ease: "power2.inOut", onUpdate: () => { count.textContent = fmt(o.v); bar.style.setProperty("--p", o.v / 1059); } })
      .to(results, { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.08, ease: EASE }, "-=0.15");
  }
  if (hasGsap && !reduce) {
    gsap.set(results, { opacity: 0 });
    ScrollTrigger.create({ trigger: demo, start: "top 75%", once: true, onEnter: runSearch });
  } else runSearch();
  demo.querySelector(".replay").addEventListener("click", runSearch);

  /* ---------- salvage pipeline: a decision travels through the loop ---------- */
  const stages = document.querySelectorAll(".pipeline li");
  let pipeTimer = null, idx = -1;
  function tick() {
    stages.forEach(s => s.classList.remove("on"));
    idx = (idx + 1) % (stages.length + 2);
    if (idx < stages.length) stages[idx].classList.add("on");
    const hold = stages[idx] && stages[idx].classList.contains("gate") ? 1100 : 420;
    pipeTimer = setTimeout(tick, hold);
  }
  if (!reduce) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !pipeTimer) tick();
      if (!e.isIntersecting && pipeTimer) { clearTimeout(pipeTimer); pipeTimer = null; }
    }, { threshold: 0.35 }).observe(document.querySelector(".pipeline"));
  }

  /* ---------- timeline line draws with scroll ---------- */
  const line = document.querySelector(".tl-line line");
  if (hasGsap && !reduce) {
    line.style.setProperty("--dash", 100);
    ScrollTrigger.create({ trigger: ".timeline", start: "top 75%", end: "bottom 60%", scrub: true,
      onUpdate: s => line.style.setProperty("--dash", 100 - s.progress * 100) });
  }

  /* ---------- screenshot tilt toward the cursor ---------- */
  if (finePointer && !reduce && hasGsap) {
    document.querySelectorAll(".tilt").forEach(el => {
      const rx = gsap.quickTo(el, "rotationX", { duration: 0.6, ease: "power3.out" });
      const ry = gsap.quickTo(el, "rotationY", { duration: 0.6, ease: "power3.out" });
      gsap.set(el, { transformPerspective: 900 });
      el.addEventListener("pointermove", e => {
        const r = el.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 10);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 8);
      });
      el.addEventListener("pointerleave", () => { rx(0); ry(0); });
    });

    /* magnetic buttons */
    document.querySelectorAll(".magnetic").forEach(el => {
      const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "elastic.out(1, 0.4)" });
      const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "elastic.out(1, 0.4)" });
      el.addEventListener("pointermove", e => {
        const r = el.getBoundingClientRect();
        x((e.clientX - r.left - r.width / 2) * 0.25);
        y((e.clientY - r.top - r.height / 2) * 0.35);
      });
      el.addEventListener("pointerleave", () => { x(0); y(0); });
    });
  }

  /* ---------- marquee: duplicate once for a seamless loop ---------- */
  const track = document.querySelector(".mq-track");
  track.innerHTML += track.innerHTML;
  track.querySelectorAll("span").forEach((s, i) => { if (i >= track.children.length / 2) s.setAttribute("aria-hidden", "true"); });

  /* ---------- copy email ---------- */
  const email = document.querySelector(".email"), tip = email.querySelector(".email-tip");
  email.addEventListener("click", async () => {
    const addr = email.dataset.email;
    try { await navigator.clipboard.writeText(addr); tip.textContent = "Copied. Talk soon."; }
    catch { location.href = "mailto:" + addr; tip.textContent = "Opening your mail app"; }
    setTimeout(() => { tip.textContent = "Click to copy"; }, 2400);
  });
})();

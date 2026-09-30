# Portfolio: Sheik Iqbal Meera John

Live: https://iqbalmeerajohn.github.io/portfolio/

One Three.js particle system (16,000 points, 9,000 on phones) runs behind the whole page. As you scroll, a custom vertex shader bursts the points apart and re-forms them into each chapter:

| Chapter | What the particles become | Source |
|---|---|---|
| Intro | the name, pushed around by the cursor | text sampled from a canvas |
| Manifesto | a memory core | Fibonacci sphere |
| Saree agent | a real saree from the project's catalogue | pixels sampled from the image, depth from luminance |
| SALVAGE | the 9-stage decision loop, policy gate in gold | procedural ring |
| GUMMY OS | the green orb from its landing page | noise-displaced sphere |
| KAFA | KAFA's raccoon logo | pixels sampled from the logo |
| CHOMPY | the gummy bear hero art | saturation-filtered screenshot |
| Journey | a drifting starfield | random volume |
| Contact | SAY HI | text |

How it works: each particle carries two target positions and colours (`pA/pB`, `cA/cB`). Scroll position picks the pair and a blend `uT`. Each particle has its own delay and burst direction, so shapes explode and re-form instead of crossfading.

Stack: Three.js, GSAP + ScrollTrigger, Lenis, vanilla JS. No build step. Respects `prefers-reduced-motion`.

Run locally: `python -m http.server` in this folder.

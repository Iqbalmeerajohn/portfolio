# Portfolio: Sheik Iqbal Meera John

Live: https://iqbalmeerajohn.github.io/portfolio/

One Three.js particle system (24,000 points on laptops, 14,000 on tablets, 9,000 on phones) runs behind the whole page. As you scroll, a custom vertex shader bursts the points apart and re-forms them into each chapter:

| Chapter | What the particles become | Source |
|---|---|---|
| Intro | the name, pushed around by the cursor | text sampled from a canvas |
| Manifesto | a memory core | Fibonacci sphere |
| Saree agent | a real saree from the project's catalogue | pixels sampled from the image, depth from luminance |
| SALVAGE | the 9-stage decision loop, policy gate in gold | procedural ring |
| GUMMY OS | the green orb from its landing page | noise-displaced sphere |
| Speech Emotion Recognition | a live 120 x 94 MFCC grid, the model's real input shape, rippling like audio | grid + height wave in the shader |
| KAFA | KAFA's raccoon logo | pixels sampled from the logo |
| CHOMPY | the gummy bear hero art | saturation-filtered screenshot |
| Journey | a portrait of me | photo cut out with rembg, skin tones kept, dark clothes lifted to slate, extra particles on the face |
| Contact | SAY HI | text |

How it works: each particle carries two target positions and colours (`pA/pB`, `cA/cB`). Scroll position picks the pair and a blend `uT`. Each particle has its own delay and burst direction, so shapes explode and re-form instead of crossfading.

Also: a fullscreen nebula shader tinted per chapter, far dust with scroll parallax, a boot log tied to real asset loading, and an optional ambient pad synthesized with WebAudio (off until you turn it on).

Stack: Three.js, GSAP + ScrollTrigger, Lenis, vanilla JS. No build step. Respects `prefers-reduced-motion`.

Run locally: `python -m http.server` in this folder.

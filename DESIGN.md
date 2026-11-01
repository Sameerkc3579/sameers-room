# Sameer's Room — Design Spec

A 3D, explorable version of the lo-fi desk-by-the-window illustration. The PC on the desk runs
**SameerOS**, a Windows-XP-styled desktop whose apps hold the portfolio content.

- **Approach:** real 3D scene modelled in Blender, with lighting baked into textures, rendered by React Three Fiber.
- **OS style:** XP (built on [XP.css](https://github.com/botoxparty/xp.css)).
- **Blender level assumed:** basic. Modelling is kept to boxes and cylinders; detailed props are downloaded or AI-generated.

---

## 1. Experience flow

```
[Intro]  existing index.html "room assembling" video plays while assets load
   │     (video ends on the finished room → crossfade into the live 3D view, same framing)
   ▼
[Room view]  slow idle camera sway · clouds drift · plants sway · dust motes in sun beams
   │         hover = object gets a soft outline + tooltip ("PC — click to use")
   │
   ├─ click MONITOR ──► camera glides to screen (1.2 s) ──► SameerOS boot → login → desktop
   │                                                         "Turn Off Computer" / Esc ──► glide back
   ├─ click BINDERS ──► camera nudges to shelf, then opens OS on "My Projects"
   ├─ click LAMP ─────► toggles evening mode (warm lamp pool, darker sky, lit city windows)
   ├─ click SMALL CRT ► zoom; plays a looping project demo reel on its screen
   ├─ click POSTER ───► zoom; poster becomes an "About me" card
   ├─ click RETRO DEVICE (right) ► lo-fi radio: play / next track (sound toggle)
   └─ click PLANT ────► little leaf rustle + sound (pure delight, no content)

Always visible (DOM overlay, bottom-left): [🔊 sound]  [2D version]  [Resume ↓]
```

**Reduced motion** (`prefers-reduced-motion`): no idle sway, camera cuts instead of glides, no dust.

---

## 2. Scene layout

Units are metres. Origin = floor, centre of the desk's front edge. **−Z points toward the window.**

| Element | Position / size | Source | Notes |
|---|---|---|---|
| Room shell | 3.6 w × 2.6 h × 3.0 d | Blender (boxes) | Side walls exist so landscape screens see more than the portrait art |
| Window | 2.4 w × 1.35 h, sill at y 0.95, wall at z −0.75 | Blender | Two sliding panes, wooden frame (see palette) |
| Soffit / upper cabinet | above window, y 2.3–2.6 | Blender | Two posters pinned to it (your own art) |
| Desk | 2.6 w × 0.7 d, top at y 0.75 | Blender | Drawer under the left side, cable tray at the back |
| Monitor | 24", screen 0.53 × 0.33, centre (0, 1.05, −0.45) | Kenney / Sketchfab, or Blender | **Screen = separate mesh named `Screen`**, a flat plane |
| Keyboard, mouse | in front of monitor | Kenney Furniture Kit | |
| Left shelf unit (on desk) | x −1.1, 0.5 w × 0.6 h | Blender | Binders = 6 coloured boxes; a box file on top |
| Small CRT + cassette deck | x −0.55 | TRELLIS.2 (cropped from reference) | Screen mesh named `CrtScreen` |
| Mug, pen cup | x 0.2 | Kenney | |
| Retro device (right) | x 0.85 | TRELLIS.2 | Screen mesh named `RadioScreen` |
| Desk lamp | x 1.15, arm leaning over | Kenney / Poly Haven | Light cone = additive transparent mesh |
| Plants on sill | x 0.4–1.0, 3 pots | Quaternius / Poly Haven | Leaves get a vertex-shader sway |
| Hanging plant | top-right corner | Quaternius | |
| Tower PC + printer | under desk left | Kenney | |
| Drawer stack + paper box | under desk centre | Blender | |
| Side cabinet | under desk right | Blender | |
| Chair | pulled back, mostly off-frame | Kenney | Only seen when the camera moves |

### Window view (three layers, no real city)

1. **Near:** the big cream apartment block on the right, a 3D box with a painted window texture. z ≈ −6.
2. **Mid:** skyline cut-out plane with rooftops, a billboard and water tanks. z ≈ −20.
3. **Far:** a lattice tower silhouette plus a gradient sky shader with drifting cloud sprites. z ≈ −60.

The layers sit at different depths, so they shift naturally against each other when the camera moves.
Build them from Kenney *City Kit* blocks rendered flat, or paint your own. **Don't cut the skyline out of the
reference illustration.** It's third-party art.

---

## 3. Cameras

| State | Position | Look at | FOV (vertical) |
|---|---|---|---|
| `room` (landscape) | (0, 1.30, 1.70) | (0, 1.20, −1.0) | 42° |
| `room` (portrait/phone) | (0, 1.35, 2.30) | (0, 1.25, −1.0) | 55°, which matches the original illustration framing |
| `screen` | in front of `Screen`, distance chosen so the screen fills 92% of viewport height | screen centre | 35° |
| `shelf` | (−0.7, 1.2, 0.6) | binders | 40° |
| `crt` / `poster` | computed from each mesh's bounding box, like `screen` | | |

- In `room`, the camera follows the mouse a little: ±0.08 m position and ±2° look. Damped with `maath/easing`.
- Transitions use GSAP `power2.inOut`, 1.2 s. User input is locked while a transition runs.
- Fit-to-object maths (`distance = (h/2) / tan(fov/2) / fill`) lives in one helper, `focusOn(mesh, fill)`.

---

## 4. Art direction

> **Update 2026-11-01 (later): sage desk nook.** Rebuilt after a new reference photo Sameer supplied: desk against the
> wall, window with blinds and a green garden on the left, two floating oak shelves with warm LED strips, pegboard
> (headphones, prints, pencil cups), trailing pothos, mushroom lamp, neon leaf, candles, humidifier mist, tulips, a
> sage keyboard + cloud wrist rest on a felt mat, and a sage chair. SameerOS was redesigned to match the photo's
> screen (modern sage: leaf wallpaper, big clock, dock, frosted windows), replacing the XP look.
> Clickable: monitor (OS), books under the riser (Projects), headphones (play/pause lo-fi), quote frame (About me),
> notebooks (Resume), mushroom lamp (lights on/off). Desk clock shows the visitor's time.


> **Update 2026-11-01:** changed from stylised/anime to **natural and photographic**, at Sameer's request ("the person
> should feel they actually live in that room"). What shipped: photo-scanned CC0 props, plants and textures from
> Poly Haven (see `CREDITS.md`), a real sunset city photo outside the window (`blender/make_backplate.py`), image-based
> lighting from the matching HDRI, a low warm sun with soft shadows, a window area light, a switchable desk lamp,
> static contact shadows, neutral tone mapping and a CSS vignette. GPUs with headroom also get live AO, bloom, grain
> and SMAA (`scene/src/Effects.tsx`). The palette and toon notes below are the original stylised plan, kept for reference.

### Palette (sampled from the reference, then tuned)

| Token | Hex | Used for |
|---|---|---|
| `sky-high` | `#94c3e6` | Upper sky |
| `sky-low` | `#b2d1e8` | Horizon |
| `cloud-peach` | `#f2c4b0` | Cloud undersides (sunset tint) |
| `building-cream` | `#f4e3c5` | Sunlit building faces |
| `frame-wood` | `#ba8e62` | Window frame, lit wood |
| `sill-warm` | `#a87062` | Sill, warm bounce light |
| `desk-edge` | `#7d4e3d` | Desk edge highlight |
| `wall-brown` | `#573f32` | Interior walls |
| `bezel` | `#3a3c41` | Monitor and electronics |
| `shadow-violet` | `#303046` | Shadow tint under the desk (shadows are violet, not black) |
| `floor-dark` | `#2a1c18` | Floor |
| `page-bg` | `#4a4448` | HTML background behind the canvas (already used in `index.html`) |

### Look

- **Lighting is baked.** Blender Cycles, one Sun lamp low behind the window (warm `#ffd2a0`, strength 4)
  plus an Area lamp filling the window opening, plus a dim cool ambient. The look we want: backlit window,
  warm rim light on the desk edge, violet shadows under the desk.
- **Runtime materials:** `MeshBasicMaterial` with the baked texture, so there are no realtime lights.
  Glass is a transparent plane with a faint gradient and fake reflection streaks.
- **Anime touch:** an inverted-hull outline, 1–1.5 px, `#2a1c18` at 60%, on props only (not walls).
  It's switchable in case it looks too busy.
- **Post-processing:** subtle bloom (on the window and screens), a slight warm colour grade, vignette and
  paper grain (noise 0.04). Turn grain off on mobile.
- **Ambient motion:** cloud drift, leaf sway, dust motes in the sun shafts (one `Points` cloud),
  and a faint flicker on the CRT screen.
- **Evening mode (v2):** a second baked lightmap. Blend `uniform uNight` from 0 to 1 over 1.5 s.
  Sky gradient goes to dusk, building windows are emissive, the lamp cone turns on.

---

## 5. The monitor — how the live screen works

**Decision:** don't keep a live iframe in the 3D world all the time. That's where most occlusion and
post-processing bugs come from.

| Camera state | What's on `Screen` |
|---|---|
| `room` | A `VideoTexture` of the SameerOS desktop (8 s loop, 1280×800, a recording of the real OS) with an emissive boost and a scanline shader. Looks alive, costs almost nothing. |
| transition to `screen` | At about 85% of the glide, mount drei `<Html transform>` exactly on `Screen` containing `<iframe src="/os/">`, then fade the video out |
| `screen` | The real interactive OS. The camera faces it head-on, so nothing occludes it and the screen-hole trick isn't needed. Post-processing is paused. |
| leaving | Unmount the iframe after the glide back starts. OS state persists in `sessionStorage`. |

- The iframe is rendered at 1280×800 CSS px and scaled down with `distanceFactor`, so text stays sharp.
- **Phones (< 768 px wide or touch-only):** after the zoom, the OS opens as a fullscreen overlay
  instead of on the in-world screen.

### Scene ↔ OS messages (`window.postMessage`, same origin)

| Direction | Message | Effect |
|---|---|---|
| OS → scene | `{type:'os:shutdown'}` | Camera returns to `room` |
| OS → scene | `{type:'os:ready'}` | Hide the video texture |
| OS → scene | `{type:'os:sound', on}` | Sync the global mute |
| scene → OS | `{type:'os:open', app:'projects', id?}` | Open a window (used by the binder click) |
| scene → OS | `{type:'os:skipBoot'}` | Skip the boot sequence when the OS is re-entered in the same session |

---

## 6. SameerOS (XP style)

Built with **XP.css**, plus a small window manager (`react-rnd` for drag and resize, `zustand` for state).
**Branding is SameerOS, not Windows:** no Microsoft logos or Windows wordmark, and no copied XP wallpaper or
icon files. Use XP-*style* icons that are open-licensed or drawn yourself, and a wallpaper rendered from our
own scene (the window view at golden hour).

### Boot sequence (about 4 s, skippable with any click)
1. Black screen with the "SameerOS" wordmark and the classic 3-block progress bar (CSS only).
2. Blue login screen with one user tile, **Sameer**, and a small avatar. Click it, or it auto-continues after 1.5 s.
3. Desktop fades in, with a startup chime (your own sound or a CC0 one).

### Desktop
- **Icons, top-left column:** My Computer · My Projects · Resume.pdf · Command Prompt · Contact · Lo-fi Player · Recycle Bin
- **Taskbar:** green **start** button, open-window buttons, and a tray with volume, GitHub and LinkedIn shortcuts and the clock (IST).
- **Start menu:** left side = the apps above. Right side = "My Documents" (Projects), "Links" (GitHub, LinkedIn, email). Bottom = **Log Off** (replays login) and **Turn Off Computer** (returns to the room).
- **First run:** a balloon tip from the tray: *"Welcome! Double-click My Projects to see what I've built."*

### Apps and their content (from the current resume)

**My Computer → System Properties** (tabbed XP dialog)
- *General:* Sameer Choudhary · B.Tech Data Science & AI, IIIT Naya Raipur (2024–2028) · CGPA 8.92/10
- *Hardware* (= skills, shown as Device Manager tree):
  Languages (Python, C++, SQL, Java, TypeScript, JavaScript) · ML/DL (PyTorch, HF Transformers, scikit-learn, YOLOv8, OpenCV) ·
  LLMs & GenAI (agents, RAG, LoRA/PEFT, LangGraph, MCP, vLLM, AWQ, guardrails) ·
  Backend & MLOps (FastAPI, WebSockets, Docker, ONNX, MongoDB, Redis, Vercel) ·
  Evaluation (P/R/F1, mAP, AUC, BLEU, COMET, leakage checks, significance testing)
- *Advanced:* coursework list + "700+ DSA problems solved (LeetCode, Codeforces)"
- *About me:* a 3–4 line bio. **Sameer to write.**

**My Projects** (Explorer window, "Tiles" view, a details pane on the left)

| Folder | Headline metric shown on the tile | Detail window contents |
|---|---|---|
| bhasha-shield | Attack success 20.5% → 6.8% | Multilingual prompt-injection red-teaming of LLM agents (EN/HI/Romanized HI/BN/code-mixed) on Qwen2.5-14B via vLLM; 7 defenses benchmarked; English-tuned guards fail on Hindi (47% false flags); recalibrated PromptGuard 2 → 51% detection @ 2% FPR |
| RecoverAI | 90% reply-intent accuracy | LLM debt-recovery agent: Gemini invoice extraction, WhatsApp/email follow-ups, MSMED notices; Hindi/Hinglish intent classifier; FastAPI + MongoDB + Redis, JWT/OAuth, SSRF guards |
| Kangri–Hindi NMT | 39.14 BLEU (prev. best 28.17) | M2M-100 / NLLB-200 fine-tuning on 23,716 pairs; fine-tuning beats 5-shot GPT-4o; meta-learning warm-up +2.0–3.3 BLEU; leakage audit; ONNX export |
| Sentinel | 78.0% mAP@50 | YOLOv8m accident detection; FastAPI + WebSocket + Next.js live dashboard; 5-hit alert debounce; ~330 ms CPU inference in Docker |
| Also built/ (sub-folder) | — | BlogGraph · ShowYourWork · AutoElicitate (one card each) |

Each detail window has a header image or GIF, a tech-stack chips row, 3 bullets, and buttons:
**[View on GitHub ↗] [Live demo ↗]**. External links open in a new tab, because GitHub refuses to load inside iframes.

**Resume.pdf**: an "Acrobat-style" viewer window that embeds the PDF, with a toolbar button to download it.

**Command Prompt**: a fake shell. Commands:
`help` · `whoami` · `ls projects` · `cat <project>` · `skills` · `contact` · `open resume` · `neofetch`
(prints SameerOS ASCII art + specs: CGPA, stack, location) · `sudo hire-sameer` (easter egg) · `clear` · `exit` (closes the window)

**Contact** (Outlook-Express style): To is prefilled with `sameerkumar12choudhary@gmail.com`. Subject and body fields,
and **Send** opens `mailto:`. A sidebar has GitHub (`Sameerkc3579`) and LinkedIn links.
**Leave the phone number off the public site.**

**Lo-fi Player** (Winamp-ish skin): 3–5 CC0 or properly licensed lo-fi tracks. Playback is synced with the radio
prop in the room, so both control the same audio element in the parent page.

**Recycle Bin**: easter egg. "first_portfolio_final_FINAL_v3.html" and "sleep_schedule.txt". Opening one shows a joke dialog.

---

## 7. Architecture

```
portfolio/
├─ index.html              current intro video page → becomes the loader inside scene/
├─ DESIGN.md
├─ blender/
│  ├─ room.blend
│  └─ reference/           fSpy camera match, reference image (not shipped)
├─ scene/                  Vite + React + TS + R3F
│  ├─ public/models/room.glb        Draco-compressed
│  ├─ public/textures/bake_day.ktx2 (+ bake_night.ktx2 in v2)
│  ├─ public/video/os_loop.mp4, intro.mp4
│  ├─ public/os/            ← built output of os/ copied here
│  └─ src/
│     ├─ App.tsx            Canvas, loader, overlay UI
│     ├─ Room.tsx           gltfjsx-generated, baked materials applied
│     ├─ Window/            sky shader, clouds, skyline layers
│     ├─ Interactables.tsx  hover outline, click → camera state
│     ├─ camera/            states, focusOn(), mouse parallax
│     ├─ Screen.tsx         video texture ⇄ <Html><iframe/></Html> swap
│     ├─ audio.ts           ambient, clicks, music (Howler)
│     └─ store.ts           zustand: cameraState, sound, evening
└─ os/                      Vite + React + TS + xp.css + react-rnd + zustand
   └─ src/
      ├─ boot/              BootScreen, LoginScreen
      ├─ shell/             Desktop, Icon, Taskbar, StartMenu, Tray, WindowManager
      ├─ apps/              SystemProperties, Explorer, ProjectView, PdfViewer,
      │                     Terminal, Contact, LofiPlayer, RecycleBin
      ├─ content/           projects.ts, profile.ts  ← all text lives here, one place to edit
      └─ bridge.ts          postMessage in/out
```

- **Deploy:** Vercel (static). One build script builds `os/` into `scene/public/os/`, then builds `scene/`.
- **2D fallback:** `/os/` also works standalone at full screen. The "2D version" link points there, and it's
  served when WebGL is missing. That page is also what search engines index.

### Performance budget

| Item | Target |
|---|---|
| First load total | ≤ 8 MB |
| `room.glb` (Draco) | ≤ 2.5 MB, ≤ 150k triangles |
| Baked atlases | 2 × 2048² KTX2 (walls/furniture, props) |
| Draw calls | ≤ 60 (merge static meshes per atlas) |
| Pixel ratio | clamp to 1.5 on desktop, 1.0 on mobile |
| Frame rate | 60 fps on a mid laptop, ≥ 30 fps on a mid phone |

---

## 8. Blender workflow (basic skill)

1. **Match the camera.** Use [fSpy](https://fspy.io) on the reference image, then the fSpy Blender importer.
   This gives a Blender camera with the illustration's perspective, and the image as its background.
2. **Block out with primitives only:** room box (delete the front face), window frame from 4 scaled cubes,
   desk = slab + legs, shelf and drawers = cubes, posters = planes. Use real-world sizes from §2.
3. **Import props** (glTF) from Kenney, Quaternius and Poly Haven. Scale them to fit. Don't remodel them.
4. **Generate the unique props** with TRELLIS.2 or Hunyuan3D: crop the small CRT, the retro device and the
   printer from the reference and generate a `.glb` for each. Decimate each to ≤ 8k triangles.
5. **Name the interactive meshes** exactly: `Screen`, `CrtScreen`, `RadioScreen`, `Binders`, `Lamp`,
   `Poster`, `Plant_*`. The code finds them by name.
6. **Simple materials:** base colours from the palette. The bake does the mood.
7. **UVs:** join the static objects into 2 groups → *UV ▸ Smart UV Project* (island margin 0.02).
8. **Bake:** Cycles, 512 samples, *Bake type: Combined*, into a 2048² image per group, then denoise.
   Keep `Screen` and the glass out of the bake.
9. **Export:** glTF, selected objects, +Y up, no lights or cameras. Then run
   `npx gltf-transform optimize room.glb out.glb --compress draco --texture-compress ktx2`.
10. **Iterate:** tweak the lights in Blender, re-bake, re-export. The code doesn't change.

Andrew Woan's free freeCodeCamp course covers steps 7–9 on screen. Watch the baking chapter first.

---

## 9. Asset sources and licences

| Need | Source | Licence |
|---|---|---|
| Desk props, PC, keyboard, chair, lamp | Kenney *Furniture Kit* | CC0 |
| Plants | Quaternius, Poly Haven | CC0 |
| City blocks for the skyline | Kenney *City Kit* | CC0 |
| Wood/plaster textures (for the bake) | Poly Haven, ambientCG | CC0 |
| Unique retro props | TRELLIS.2 (MIT) generated from your crops | yours |
| UI | XP.css | MIT |
| Icons | open-licensed XP-style set, or hand-drawn 32×32 | check each set |
| Sounds (ambience, clicks, chime) | Freesound (CC0 filter) | CC0 |
| Lo-fi tracks | Pixabay Music, or tracks you have rights to | check per track |
| Posters, wallpaper | your own renders or art | yours |

Keep a `CREDITS.md` and an "About this site" dialog in the OS listing all of them.

---

## 10. Milestones

- [x] **M1 OS first:** `os/` running standalone. Boot, desktop, all apps with real content. This is already a usable 2D portfolio. *(Done 2026-11-01. Run: `cd os && npm run dev`)*
- [x] **M2 Blockout:** room generated by `blender/build_room.py` (headless Blender, no manual modelling), loaded by the R3F scene with room/portrait/screen camera states. *(Done 2026-11-01)*
- [x] **M3 Screen:** still-image screen ⇄ live iframe swap, zoom in/out, postMessage bridge with `os:hello` handshake, phone fullscreen. Binders, radio, CRT and poster open the matching OS app; the lamp toggles. *(Done 2026-11-01; the looping video texture is still to do)*
- [x] **M4 Look:** realistic room (see §4 update): scanned assets, PBR textures, city photo, HDRI lighting, quality tiers. Runs ~30 fps on Intel Iris Xe at 1440×860 in the default tier. *(Done 2026-11-01)*
- [x] **M5 Interactables & audio:** books → My Projects, TV → Command Prompt, poster → About, radio plays/pauses the lo-fi music in place (with a now-playing chip), lamp toggles its light, monitor shows a recorded OS loop. *(Done 2026-11-01)*
- [x] **M6 Ship (build side):** designed loader, glb compressed 52 MB → 7.8 MB (WebP + meshopt), post-processing lazy-loaded, 2D fallback link, meta description. Total site ≈ 13 MB. *(Done 2026-11-01)*
- [x] **Deploy:** live at https://sameers-room.vercel.app (Vercel project `sameers-room`, account sameerkc3579). Redeploy: `cd scene && npm run build`, then `npx vercel deploy dist --prod` from a folder named `sameers-room` (or link the project once). *(2026-11-02)*
- [ ] **v2:** evening mode bake and lamp toggle.

## How to run

- Room: `cd scene && npm run dev` → http://localhost:5173 (or the port it prints)
- Rebuild the room after editing `blender/build_room.py`: `cd scene && npm run room` (needs `python blender/fetch_assets.py` once)
- Rebuild the OS into the scene: `cd scene && npm run os`
- Production build: `cd scene && npm run build` → `scene/dist/` (static files; upload anywhere)
- Debug: add `?fx` to the room URL to force the high-quality effects on
- OS alone (2D version): `cd os && npm run dev`

## 11. Content status

Personal content lives in `os/src/content/profile.ts` and `os/src/content/projects.ts`, so edits only touch those two files.

- [x] Bio: drafted from the resume. **Review the wording.**
- [x] Avatar: placeholder SVG (`os/public/avatar.svg`). Replace it with a real photo or illustration (same filename, any square image).
- [ ] Per-project repo URLs: every project currently links to github.com/Sameerkc3579. Set `github` (and optional `demo`) per project.
- [ ] A screenshot or GIF per project (the project window has room for a header image).
- [x] Music: 4 original lo-fi loops generated live with Web Audio (`os/src/audio/lofi.ts`), so there are no files and no licences.
- [x] Poster art: the golden-hour skyline painting (our own) in the frame above the window; avatar in the desk photo frame.

# Sameer's Room

My portfolio as a cosy, sage-green desk nook you can walk around in: **https://sameers-room.vercel.app**

Click (or tap) the glowing dots to explore. The monitor runs **SameerOS**, a small desktop with my projects,
resume, a terminal and a lo-fi player. Books on the desk open as real books, the pegboard shows my live coding
stats, and the room follows the time and weather in Raipur.

## What's in the room

- **Projects, About me, Resume** open as books (the resume is a zoomable PDF).
- **Use the computer**: SameerOS grows out of the monitor. There's also a [2D version](https://sameers-room.vercel.app/os/index.html).
- **Ask Sameer**: a chat bot (rule-based, runs in your browser, no API key) that answers questions about my work
  and moves things in the room: "show me your resume", "turn the lights off".
- **Hiring? 60-sec tour**: a guided camera tour for recruiters.
- **How it was built**: the room takes itself apart, then builds itself again in the order it was really built, one
  commit of this repo at a time.
- **Live stats** from LeetCode, Codeforces and GitHub on the pegboard.
- **Guestbook**: every note grows a new leaf on the vine along the top shelf.
- **Fireflies**: other visitors, live, drifting near whatever they're looking at.
- **Lights off**: the blinds close and your cursor becomes a torch.
- **Break my agent**: a 6-level prompt-injection game in SameerOS.
- **Injection detector**: a real prompt-injection classifier
  ([yzdvai/tiny-injection-guard](https://huggingface.co/yzdvai/tiny-injection-guard)) running on your device with
  transformers.js. Try an attack in English, then the same attack in Hindi.
- **हिंदी**: the room's interface in Hindi.
- **A puzzle hunt** hidden across the room. No spoilers.
- Works on phones of any size: swipe to look around, lighter rendering, every animation kept.

## How it's built

| Folder | What |
| --- | --- |
| `blender/` | Headless Blender scripts that model and light the room from CC0 Poly Haven assets and export `room.glb` |
| `os/` | SameerOS: React + TypeScript + Vite |
| `scene/` | The 3D room: React Three Fiber, drei, Zustand, Vite |
| `scene/api`, `scene/server` | Vercel functions for the guestbook, puzzle hunt, live stats and fireflies (Upstash Redis) |

## Run it locally

```bash
cd os && npm install
cd ../scene && npm install
npm run dev        # the room at http://localhost:5173
```

`npm run build` builds SameerOS into the scene and then the scene itself. Vercel deploys every push to `main`
(root directory `scene/`, settings in `scene/vercel.json`). The guestbook, hunt and fireflies need `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` (set in Vercel, never committed); without them the rest of the room still works.

## Credits

3D assets, textures and the sky are CC0 from Poly Haven. See [CREDITS.md](CREDITS.md).

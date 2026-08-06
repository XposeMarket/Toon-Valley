# Toon Valley

A lightweight cel-shaded open-world life simulator built with Three.js. Toon Valley is designed to run on phones, tablets, and older integrated-graphics laptops while still supporting a persistent Sims-style gameplay loop.

## Current playable systems

- Expanded cel-shaded town with civic, commercial, residential, park, and mountain areas
- Enterable City Hall, general store, library, cafe, furniture store, and player home
- IndexedDB save system with localStorage emergency fallback
- Three save slots, autosave, manual save, portable export, and import
- Installable PWA manifest and offline service worker
- Valley Bucks economy, inventory, grocery store, and furniture catalog
- Four needs: energy, hunger, happiness, and hygiene
- Ten skills with XP, level progression, and gameplay bonuses
- Four working jobs:
  - Cafe Rush order-matching minigame
  - Sunshine Park cleanup route
  - Three-stop parcel delivery route
  - Town-square rhythm performance
- Main story progression and rotating daily tasks
- Sixteen named residents with relationships, gifts, dialogue, memories, and time-based schedules
- Home ownership ladder with four property tiers
- Furniture buying, persistent placement, rotation, moving, storage, and capacity limits
- Fifteen recognizable furniture and appliance models built from optimized low-poly geometry
- Wallpaper and flooring remodeling
- Interactive bed, kitchen, and shower
- Day/night lighting, clock, weather, rain, town events, and Saturday discounts
- Three fundable community projects that visibly change the town
- Mobile joystick, touch camera, action controls, build controls, safe-area support, and responsive UI

## Controls

### Desktop

- **WASD** — move
- **Mouse** — camera
- **Shift** — sprint
- **Space** — jump
- **E** — interact
- **Q** — graphics quality
- **Esc** — release mouse / pause

### Furniture placement

- **WASD or arrow keys** — move furniture on the room grid
- **R** — rotate
- **Enter** — place
- **Esc** — cancel

### Mobile

- Left joystick — movement
- Drag the right side — camera
- RUN, JUMP, and USE — actions
- On-screen build controls — move, rotate, place, or cancel furniture

## Performance architecture

- Mobile, Low, and Medium device presets
- 30 FPS mobile and 45 FPS low-power targets
- Adaptive internal render resolution
- Retina pixel-ratio caps
- Instanced grass, trees, rocks, flowers, road markings, lamps, and mountains
- Shared geometries and toon materials
- No physics engine, real-time shadows, or post-processing
- Fog-limited draw distance and automatic frustum culling
- Lower-frequency distant NPC logic
- Interiors removed from traversal while outdoors
- Paused rendering/simulation when backgrounded
- Low-count rain particles and throttled day/weather visual updates
- Data-driven jobs, quests, shops, skills, and save state

## Run locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

On macOS, `run-mac.command` starts the same local server.

## Project files

- `index.html` — page shell and core game HUD
- `style.css` — original world and control interface
- `game.js` — Three.js renderer, terrain, town, characters, movement, interiors, interactions, and performance scaling
- `life.css` — life-simulation HUD, menus, shops, minigames, and build interface
- `life.js` — persistence, economy, needs, jobs, quests, relationships, home decoration, time, weather, and town progression
- `manifest.webmanifest` — installable app metadata
- `sw.js` — offline cache and PWA service worker
- `icon.svg` — Toon Valley app icon
- `vercel.json` — static deployment headers and cache behavior
